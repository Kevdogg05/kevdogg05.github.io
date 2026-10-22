import { describe, expect, it } from "vitest";
import { fitDimensions, MediaError, parseProbe, renderArgs, renderFilterGraph } from "./media";

describe("parseProbe", () => {
  const phone = {
    format: { duration: "12.5" },
    streams: [
      {
        codec_type: "video",
        codec_name: "hevc",
        width: 1920,
        height: 1080,
        avg_frame_rate: "30000/1001",
        sample_aspect_ratio: "1:1",
        side_data_list: [{ rotation: -90 }],
      },
      { codec_type: "audio", codec_name: "aac" },
    ],
  };

  it("applies rotation so a portrait phone video reads as portrait", () => {
    expect(parseProbe(phone)).toEqual({
      duration: 12.5,
      width: 1080,
      height: 1920,
      fps: 29.97,
      videoCodec: "hevc",
      hasAudio: true,
      audioCodec: "aac",
    });
  });

  it("handles legacy rotate tags, non-square pixels and silent videos", () => {
    const info = parseProbe({
      format: { duration: "3" },
      streams: [{ codec_type: "video", width: 720, height: 480, sample_aspect_ratio: "32:27", tags: { rotate: "180" } }],
    });
    expect(info).toMatchObject({ width: 853, height: 480, hasAudio: false, fps: null });
  });

  it("ignores cover art and rejects files without a real video stream", () => {
    const audioOnly = {
      format: { duration: "60" },
      streams: [
        { codec_type: "audio", codec_name: "mp3" },
        { codec_type: "video", codec_name: "mjpeg", width: 500, height: 500, disposition: { attached_pic: 1 } },
      ],
    };
    expect(() => parseProbe(audioOnly)).toThrow(MediaError);
    try {
      parseProbe(audioOnly);
    } catch (error) {
      expect((error as MediaError).permanent).toBe(true);
    }
  });
});

describe("fitDimensions", () => {
  it("fits landscape, portrait and square videos into 720p without upscaling", () => {
    expect(fitDimensions(3840, 2160, 1280)).toEqual({ width: 1280, height: 720 });
    expect(fitDimensions(1080, 1920, 1280)).toEqual({ width: 720, height: 1280 });
    expect(fitDimensions(1080, 1080, 1280)).toEqual({ width: 720, height: 720 });
    expect(fitDimensions(640, 360, 1280)).toEqual({ width: 640, height: 360 });
    expect(fitDimensions(853, 480, 1280)).toEqual({ width: 854, height: 480 });
  });
});

describe("render command", () => {
  const options = {
    input: "raw.mov",
    output: "edited.mp4",
    webmOutput: null,
    kept: [
      { start: 2.25, end: 5.75 },
      { start: 8.25, end: 13.75 },
    ],
    hasAudio: true,
    width: 720,
    height: 1280,
    captions: { file: "captions.ass", fontsDir: "fonts" },
    normalizeAudio: true,
    crf: 23,
    preset: "medium",
  };

  it("trims and joins the kept pieces, then scales, captions and levels in one graph", () => {
    expect(renderFilterGraph({ ...options, webm: false }).split(";")).toEqual([
      "[0:v:0]split=2[v0][v1]",
      "[v0]trim=start=2.250:end=5.750,setpts=PTS-STARTPTS[vt0]",
      "[v1]trim=start=8.250:end=13.750,setpts=PTS-STARTPTS[vt1]",
      "[0:a:0]asplit=2[a0][a1]",
      "[a0]atrim=start=2.250:end=5.750,asetpts=PTS-STARTPTS[at0]",
      "[a1]atrim=start=8.250:end=13.750,asetpts=PTS-STARTPTS[at1]",
      "[vt0][at0][vt1][at1]concat=n=2:v=1:a=1[vc][ac]",
      "[vc]scale=720:1280:flags=lanczos,setsar=1,format=yuv420p,ass=filename=captions.ass:fontsdir=fonts[v]",
      "[ac]loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[a]",
    ]);
  });

  it("handles videos without sound or captions", () => {
    const graph = renderFilterGraph({ ...options, webm: false, hasAudio: false, captions: null });
    expect(graph).not.toContain("asplit");
    expect(graph).not.toContain("ass=");
    expect(graph).toContain("[vt0][vt1]concat=n=2:v=1:a=0[vc]");
    expect(renderArgs({ ...options, hasAudio: false })).not.toContain("[a]");
  });

  it("feeds one decode into both an MP4 and a WebM encoder when asked", () => {
    const graph = renderFilterGraph({ ...options, webm: true }).split(";");
    expect(graph.at(-2)).toMatch(/fontsdir=fonts,split=2\[v\]\[vw\]$/);
    expect(graph.at(-1)).toBe("[ac]loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000,asplit=2[a][aw]");

    const args = renderArgs({ ...options, webmOutput: "edited.webm" });
    const webmStart = args.indexOf("[vw]") - 1;
    expect(args.slice(0, webmStart).at(-1)).toBe("edited.mp4");
    expect(args.slice(webmStart)).toEqual(expect.arrayContaining(["libvpx-vp9", "libopus", "-map_metadata", "edited.webm"]));
    expect(args.at(-1)).toBe("edited.webm");
  });

  it("encodes web-friendly H.264 and strips location metadata", () => {
    const args = renderArgs(options);
    expect(args).toEqual(expect.arrayContaining(["libx264", "yuv420p", "+faststart", "aac"]));
    expect(args.join(" ")).toContain("-map_metadata -1");
    expect(args.at(-1)).toBe("edited.mp4");
  });
});
