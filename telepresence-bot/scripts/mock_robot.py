#!/usr/bin/env python3
"""Simulated TeleBot, for working on the dashboard without the hardware.

Speaks the firmware's protocol (firmware/include/drive.h) with the same
mixing, ramp and failsafe rules, using only the Python standard library:

    http://localhost:8080/            dashboard (../web/index.html, re-read on every load)
    ws://localhost:8080/ws            control channel
    http://localhost:8080/status      state JSON
    http://localhost:8080/debug/log   the last 200 commands received (for tests)
    http://localhost:8081/stream      MJPEG test pattern (live overlay if Pillow is installed)

    python3 scripts/mock_robot.py [--port 8080] [--bind 127.0.0.1] [--token SECRET]

Use --bind 0.0.0.0 to drive the mock from a phone on the same network.
"""

import argparse
import base64
import hashlib
import io
import json
import os
import socketserver
import struct
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

HERE = os.path.dirname(os.path.abspath(__file__))
DASHBOARD = os.path.join(HERE, "..", "web", "index.html")
WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
FRAME_SIZES = ["qvga", "cif", "hvga", "vga", "svga"]

# Firmware defaults (firmware/include/config.h)
DUTY_MAX = 255
RAMP_UP, RAMP_DOWN = 12, 40
SPIN_SCALE = 60
CONTROL_HZ = 100

# 320x240 test card, JPEG
TESTCARD_JPEG = base64.b64decode(
    "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAA4KCw0LCQ4NDA0QDw4RFiQXFhQUFiwgIRokNC43NjMuMjI6QVNGOj1OPjIySGJJ"
    "TlZYXV5dOEVmbWVabFNbXVn/2wBDAQ8QEBYTFioXFypZOzI7WVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZ"
    "WVlZWVlZWVlZWVlZWVn/wAARCADwAUADASIAAhEBAxEB/8QAGwABAQADAQEBAAAAAAAAAAAAAAECAwQFBgf/xABBEAABAgMF"
    "BgIHBQgBBQEAAAABAAIDBBIRITFxkQUiMkFRUhTRExUzVGGBsRZTk6GiBjVCcnOSo/BDI4PB4fFi/8QAGgEBAAIDAQAAAAAA"
    "AAAAAAAAAAIDAQUGBP/EADURAQABAgEHCwMEAwEAAAAAAAABAgMRBBIVITFRcQUTFDRBUoGhsdHwIjKRBiMzYUJyweH/2gAM"
    "AwEAAhEDEQA/APhHOdUbzj1Uqd3HVH8bs1FJhlU6k3nEc1Kndx1QcBzCiC1O7jqq5zqjeceqxVfxuzQKndx1VqdSbziOaxVH"
    "AcwgVO7jqlTu46qIgyc51RvOPVSp3cdUfxuzUQZVOpN5xHNSp3cdUHAcwogtTu46quc6o3nHqsVX8bs0Cp3cdVanUm84jmsV"
    "RwHMIFTu46pU7uOqiIMnOdUbzj1Uqd3HVbZ1jYc7MMYLGtiOAHQWrSjETjGLKp1JvOI5qVO7jqg4DmFEZWp3cdVXOdUbzj1W"
    "Kr+N2aBU7uOqtTqTecRzWKo4DmECp3cdUqd3HVREGTnOqN5x6qVO7jqj+N2aiDKp1JvOI5qVO7jqg4DmFEFqd3HVVznVG849"
    "Viq/jdmgVO7jqrU6k3nEc1iqOA5hAqd3HVKndx1URBk6mo3nHopu9Toj+N2aiDLdpN5xHJTd6nRBwHMKILu9Toq6mo3nHosV"
    "X8bs0Dd6nRXdpN5xHJYqjgOYQN3qdE3ep0URBk6mo3nHopu9Toj+N2aiDLdpN5xHJTd6nRBwHMKILu9Toq6mo3nHosVX8bs0"
    "Dd6nRZw4ZimiG173E3BrbScV6EnsoOgiZnool5Yg2X2OdddZ/vJbHbYhy0NzNmyzILDcXvFrj/8AL8bVHO7IUTdmZwtxjPkw"
    "gbBnIzaiGwhYCPSG8/IW/mtrtiS8M0RtpQYcQAVNIF2pXlx5uYmLfTRojwTVYXXA5YBaVjCreZl2dtWHCPd78xsmWjzsU+so"
    "TYkSITRYCQScMVzxf2enGNBaWRDbg03/AJ2Lg2h+8Zr+q/6la4UeNAt9DFiQ6saHEWrERVhtRpouxTExV+YWJBfB3YrIkMmw"
    "2ObYea17vU6L1oe2nRYXop+AyYhW2E2WOFvPpbZlmkfZcKZgmY2Y/wBIwCp0Enfb8P8AenNZzsPuSi7NOq5GH99jyd3qdFXU"
    "1G849Fiq/jdmprzd6nRXdpN5xHJYqjgOYQN3qdE3ep0URBk6mo3nHopu9Toj+N2aiDLdpN5xHJTd6nRBwHMKILu9Toq6mo3n"
    "HosVX8bs0Dd6nRXdpN5xHJYqjgOYQN3qdE3ep0URBX8bs1Fk5zqjeceqlTu46oA4DmFFlU6k3nEc1Kndx1QRV/G7NKndx1Vc"
    "51RvOPVBiqOA5hKndx1VqdSbziOaDFFandx1Sp3cdUB/G7NRZOc6o3nHqpU7uOqAOA5hRZVOpN5xHNSp3cdUEXtScGBs+XG0"
    "JsVxHEmBC6/H/wB8s7Fz7HlhMR3xo7iJeXHpH87fhZ8jotO0p6LOTTnlxENpIY3CweahOucHnrxuVc3Gzt9mucnY87ED477b"
    "LaWi4NyWgcBzCVO7jqrU6k3nEc1OIwXxEUxhDFFandx1Sp3cdUZb9ofvGa/qv+pXOunaDnesZq8+1dz+JXPU7uOqxGxCj7YB"
    "wHMLZLTMaVi+kgPLH2WWjosKnUm84jmpU7uOqylMRMYS9uM2DtqWdHhAQ56E217APaAdP9+HQrxH8bs1ulZuNKR2xYTyHDkc"
    "COhXobahMeIe0JZzvRRzY4YUu/0HT4qEfTOHYop/aqzOydnt7PIVHAcwlTu46q1OpN5xHNTehiitTu46pU7uOqA/jdmosnOd"
    "Ubzj1Uqd3HVAHAcwosqnUm84jmpU7uOqCKv43ZpU7uOqrnOqN5x6oMVRwHMJU7uOqtTqTecRzQYorU7uOqVO7jqgP43ZqLJ1"
    "NRvOPRTd6nRAHAcwost2k3nEclN3qdEEVfxuzTd6nRV1NRvOPRBiqOA5hN3qdFd2k3nEckGKK7vU6Ju9TogP43ZqLJ1NRvOP"
    "RTd6nRAHAcwost2k3nEclukoLY87AhEOeHPAcAOVt/5JOpiZwjGXpT1kjsSBKAkRY5ESICL7OhHLkPkV4z+N2a9P9oYnpNqv"
    "a670bWtFg5WW/wDlea6mo3nHoo0bMVNiPoiZ2zr/ACxVHAcwm71Oiu7SbziOSkvYoru9Tom71OiDftD94zX9V/1K5107Qp9Y"
    "zV59q7l8Sufd6nRYjYhR9sA4DmFFlu0m84jkpu9Tospova2MWTMKb2fFdYIoqZ8CPzPI2fArxt3qdF2bMiei2rAc28mJTeOt"
    "x+qjVGMKr1OdROG1xuaWOLXAtcDYQReCg4DmF37bgthbVjANc0OIcLsbRedbVw7tJvOI5LMTjGKVFWdTFW9iiu71OibvU6LK"
    "Y/jdmosnU1G849FN3qdEAcBzCiy3aTecRyU3ep0QRV/G7NN3qdFXU1G849EGKo4DmE3ep0V3aTecRyQYoru9Tom71OiA/jdm"
    "oq/jdmogo4DmFFRwHMKICr+N2air+N2aCKjgOYUVHAcwgiIiCv43ZrbDlokRgc10IA90VjToTatT+N2aiMTj2OnwcWk70DEf"
    "87PNd2xZaJD2rAc50IgVcMVjjwnkDavJHAcwu3Yr2w9rS7nmwElvzIIH5lRqxwlTdirm6uErPSkR0/MuDoNhiuN8ZgOJ5WrS"
    "6Ti1HegY/fs81ltWGYW05lriCS8uu6G8fVcr+N2aRjglRnTTExPz8t/g4vdA/HZ5q+Di0negYj/nZ5rmVHAcws608Kt/z8t/"
    "g4vdA/HZ5p4OL3QPx2ea50TWYVb/AJ+XfPSkR0/MuDoNhiuN8ZgOJ5WrR4OL3QPx2eabQ/eM1/Vf9SudYjHBCiKs2Nfz8unw"
    "cWk70DEf87PNTwcXugfjs81oHAcwos608Kt/z8ujwcXugfjs81XScWo70DH79nmuZbIcMxplsJpAc94aLcLSU1sTnR2/Py9r"
    "9opd8Wfhua6EB6IDeitacTyJXleDi0negYj/AJ2ea7v2le1+0w1ptLIYa74G0n6ELyRwHMKNGObCnJ4q5qludKRGtLi6DYBb"
    "dGYTpatCIpvRGPar+N2air+N2aiMqOA5hRUcBzCiAq/jdmoq/jdmgio4DmFFRwHMIIiIgyc51RvOPVSp3cdUfxuzUQZVOpN5"
    "xHNSp3cdUHAcwogtTu46quc6o3nHqsVX8bs0Cp3cdVanUm84jmsVRwHMIFTu46pU7uOqiIMnOdUbzj1Uqd3HVH8bs1EGVTqT"
    "ecRzWUGM+DGZFabSxwcAcLlgOA5hRGJjF7H7QtHioUzCt9HHhhwdbxHLldYvJc51RvOPVexLOO0tiRJW0mPLGtgtvc3p1OJG"
    "i8Z/G7NQo2YblNjVTmTtj5BU7uOqtTqTecRzWKo4DmFNeVO7jqlTu46qIg6doOd6xmrz7V3P4lc9Tu46rftD94zX9V/1K51i"
    "NiFH2wyqdSbziOalTu46oOA5hRZTWp3cdV6WxYRj7WhgguZDJeb7LLMPzsXmL24LjszY8WNaWx5s0sFthDRbf15m/wCIUa51"
    "YKb8zFGbG2dTztozRmZ+NFa7dc7dstFoFw/ILnqdSbziOaxVHAcwpRGGpZTTFMREFTu46pU7uOqiIkyc51RvOPVSp3cdUfxu"
    "zUQZVOpN5xHNSp3cdUHAcwogtTu46quc6o3nHqsVX8bs0Cp3cdVanUm84jmsVRwHMIFTu46pU7uOqiIMnU1G849FN3qdEfxu"
    "zUQZbtJvOI5KbvU6IOA5hRBd3qdFXU1G849Fiq/jdmgbvU6K7tJvOI5LFUcBzCBu9Tom71OiiIMnU1G849FN3qdEfxuzUQZb"
    "tJvOI5KbvU6IOA5hRB0SU06TmWRobnXHeA/iHMLv2tKQ3sbtCWrMGMSX3cLrfO3/AEheQvQ2ftF0lGex7fSS0QkRIZv+Y/29"
    "RqjthTcomJz6NvrDg3ep0V3aTecRyXqzGy2R4DZrZhdEhG2qGTvMONn/AKxztXkjgOYWYmJTouU1xqN3qdE3ep0URZTdO0Kf"
    "WM1efau5fErn3ep0W/aH7xmv6r/qVzrEbEKPthlu0m84jkpu9Tog4DmF6cjsoxIRmZ1xgSobVVzd0s/2+6zFJmI2lddNEY1M"
    "NlSDJl740esSsEFz3WY2cv8A5/5WG1J0z0255LxDbcxp5D/2s9o7SEeEyWlWGDKMHDzcfj/vxXnv43ZrERMzjKuimaqs+vw/"
    "r/03ep0V3aTecRyWKo4DmFJebvU6Ju9TooiDJ1NRvOPRTd6nRH8bs1EGW7SbziOSm71OiDgOYUQXd6nRV1NRvOPRYqv43ZoG"
    "71Oiu7SbziOSxVHAcwgbvU6Ju9TooiCv43ZqLJznVG849VKndx1QBwHMKLKp1JvOI5qVO7jqgir+N2aVO7jqq5zqjeceqDFU"
    "cBzCVO7jqrU6k3nEc0GKK1O7jqlTu46oD+N2aiyc51RvOPVSp3cdUAcBzCiyqdSbziOalTu46oIq/jdmlTu46quc6o3nHqgz"
    "lpmNKxfSQHlj7LLR0XrN2hIz4PrGXEOIbvTQ7emJ58h1Xi1O7jqrU6k3nEc1GaYlVXapr17J3vY9Rw5hpfIzsKKLbaXXFoOF"
    "tnP5Bc8TYU+x5a2E14H8TXiw62FedU7uOq3NnZprQ1szGAAsAEQ3LGFUdqOZdjZVjxj2ejNbGno0/Ge2EAx8VxDi8WWE442r"
    "L1AYTS6bnIMBttjTiCfnYuSenZpk/MtbMxmtEVwAEQ2AWlcNTu46rERVMbUaabs0x9UR4PaM1syQYDJQTMxhhEiW2A32G/mL"
    "sAM15k5Ox52IHx322W0tFwbktNTqTecRzUqd3HVSimI1rKLVNM47Z3yir+N2aVO7jqq5zqjeceqktYqjgOYSp3cdVanUm84j"
    "mgxRWp3cdUqd3HVAfxuzUWTnOqN5x6qVO7jqgDgOYUWVTqTecRzUqd3HVBFX8bs0qd3HVVznVG849UGKo4DmEqd3HVWp1JvO"
    "I5oMUVqd3HVKndx1QH8bs1FkaSSbTf8ABTd6nRAHAcwost2wi06KbvU6IIq/jdmm71OippJJtN/wQYqjgOYTd6nRXdsItOiD"
    "FFd3qdE3ep0QH8bs1FkaSSbTf8FN3qdEAcBzCiy3bCLTopu9Togir+N2abvU6Kmkkm03/BBiqOA5hN3qdFd2wi06IMUV3ep0"
    "Td6nRBnMRDFmIsR1gL3Fxs+JWtZGkkm03/BTd6nRGI1agcBzCiy3bCLTopu9TojKKv43Zpu9ToqaSSbTf8EGKo4DmE3ep0V3"
    "bCLTogxRXd6nRN3qdEB/G7NRZGkkm03/AAU3ep0QBwHMKLLdsItOim71OiCKv43Zpu9ToqaSSbTf8EGKo4DmE3ep0V3bCLTo"
    "gxRXd6nRN3qdEHr/AGX2x7n/AJWeafZfbHuf+Vnmv0pFjFl+a/ZfbHuf+Vnmn2X2x7n/AJWea/SkTEfmv2X2x7n/AJWeajv2"
    "Z2u0WmUs/wC4zzX6WtUfgGapv3Zt25rjsZiMZfm/2c2r7r/kZ5p9nNq+6/5Gea/QEWl0re3R5+6zm4fn/wBnNq+6/wCRnmn2"
    "c2r7r/kZ5r9ARNK3t0efuc3D8/8As5tX3X/IzzWD9g7SYbHS1h/nb5r9DXHOe1H8q9uQZbcyi9zdcRh/Tx5bcmxaz6dr4b1J"
    "tD3f9bfNPUm0Pd/1t819ii3vM0tNpS9ujz93x3qTaHu/62+aepNoe7/rb5r7FE5mk0pe3R5+7471JtD3f9bfNYHZM6DYYH62"
    "+a+0XI/jdmvDltc2KYmntSp5Suz2R5+75b1VO/c/rb5p6qnfuf1t819Oi1vTrm6PninpC7uj54vmPVU79z+tvmnqqd+5/W3z"
    "X06J065uj54mkLu6Pni+XdsycY0udBsA/wD0PNa/AzH3f6gvqJn2Dvl9VwLd8nURlNqa69uOGrwdDyVajLLM3LmqYnDVwjjv"
    "eN4GY+7/AFBPAzH3f6gvZRbDoVvfLaaOtb5+eDxvAzH3f6gngZj7v9QXsonQre+TR1rfPzweK6UjtsqZZb8QsfDxe38wvWmP"
    "4fmtC0+VVzauzRTsj2WU8l2ZjHGfL2cHh4vb+YTw8Xt/MLvRefpFSWirO+fL2cHh4vb+YTw8Xt/MLvROkVGirO+fL2eY5pY4"
    "tcLCFFtmfbu+X0WpdLY5PtXLVNczOMxE/NTnr30XKqI7JmBERXaMtb58vZVnyIiJoy1vny9jPl+xIiLnlwiIgLVH4Bmtq1R+"
    "AZry5Z/BVwSp2udERcsvEREBcc57UfyrsXHOe1H8q2vI/WY4S1nKvV54w50RF17lhERAXI/jdmutcj+N2a1PKv2U8VlDFERa"
    "JYIiINcz7B3y+q4F3zPsHfL6rgXV8idXnj/yHbfp7qtX+0+kCIi3LoBERBpmP4fmtC3zH8PzWhczl/WKvD0hdRsERF4khERB"
    "wTPt3fL6LUtsz7d3y+i1LvMk6vb4R6OLyr+evjPqIiL0POIiIP2JERcY9IiIgLVH4Bmtq1R+AZry5Z/BVwSp2udERcsvEREB"
    "cc57UfyrsXHOe1H8q2vI/WY4S1nKvV54w50RF17lhERAXI/jdmutcj+N2a1PKv2U8VlDFERaJYIiINcz7B3y+q4F3zPsHfL6"
    "rgXV8idXnj/yHbfp7qtX+0+kCIi3LoBERBpmP4fmtC3zH8PzWhczl/WKvD0hdRsERF4khERBwTPt3fL6LUtsz7d3y+i1LvMk"
    "6vb4R6OLyr+evjPqIiL0POIiIP2JF+U+tto+/wA3+M7zT1ttH3+b/Gd5rjcHpfqyL8p9bbR9/m/xneaetto+/wA3+M7zTAfq"
    "y1R+AZr8u9bbR9/m/wAZ3modq7QOM/NH/vO81VftTctzRHaROEv0pF+aes5/32Z/Fd5p6zn/AH2Z/Fd5rT6Jr70LOch+lovz"
    "T1nP++zP4rvNPWc/77M/iu800TX3oOch+lrjnPaj+VfAes5/32Z/Fd5qHaE642unJgn4xXea9mRZFVk13nJnF5cstzlFrMjU"
    "+4RfDeOm/eo/4hTx0371H/EK3fPRuajRdfeh9yi+G8dN+9R/xCnjpv3qP+IU56NxouvvQ+5XI/jdmvkfHTfvUf8AEKnjJr3m"
    "N/eV4sso6RTERqwSp5Mrj/J9ai+R8ZM+8Rv7ynjJn3iN/eVr+gVb09HVd59ci+R8ZM+8Rv7ynjJn3iN/eU6BVvNHVd59VM+w"
    "d8vquBeIZuYIsMxFI+LysfTxvvYn9xW4yCvotuaKtevH0b7ky7GR2pt1a8Zx8o9nuovC9PG+9if3FPTxvvYn9xXu6bTubLSV"
    "Pde6i8L08b72J/cU9PG+9if3FOm07jSVPdevMfw/NaF5xjRTjEec3FT0sTvdqtVlNHPXZrjtTjlSiIwzZeki830sTvdqnpYn"
    "e7Vefo872dK0d2XpIvN9LE73ap6WJ3u1To87zStHdlnM+3d8votSpJJtJJPxUXRWeUabdumiadkRDRXf3LlVcdszIiIrdKUd"
    "2VeYIiJpSjuyZgiItGsEREBERAREQEREH0MrPOibE2hMPlpExYL4IY7wcK4Oqt/h+AWMrsgTEnCno8rOzHinuIEnCAbDANhJ"
    "saRjbY0WYLy4E76HZs3J+jq8Q6G6urhpq5c7al0S+04Qk4MvNyro7ZdxMItillgJtINxtFuRvN6D0ZrZsWFsuHs0ODovrV8F"
    "rsASWMAKwndgthS846FAn4bpQVeljw7IcYAgGm67G0Xm5cR2w7wvo2wGw4rZszcN8M2NYbBdTZhcOak5tOBHhxzCkhDjTBte"
    "90SsNvtNAs3bcyg99kKVExsyDEfsxkCJLQXRILpf/qxCWi2xwbif5l4UKRlYcnHnZwRxCEcwIcFhDXlwFptJBssFnLEra7a8"
    "nEiSkeJIRHx5aFDhtPiLGOoAAJbTbywtWhm1hEhzMKfgeIhR4xmCGPoc2IcSDYcelnRB6ey9nSUPbEo8sfMSc1LRYkNsSm1p"
    "DXAh1xBspNmF9h5WLy9jycvtHbLZZ5iQpd4iOtBBc0BrnC+yw4DlotsPbno9pSsw2WaJeWhuhQ4AeeEgg73U1E22Ll2fPMkN"
    "peKhwS5gERrYbn3gOaWi02X2W9OSDv8AB7JGzYW0CZ30ToxgOhVtqtABqtssssOFnzUibGgys3tPxUWI6WkHBv8A07A+IXGx"
    "ovuGBJN+C88ztuyGSPo+GO6NXVja0Cyz5Lti7cEefn4sWVDpaeIMSDXYQReCHWYjLmg2QtjQJ50lFkosSHLzD3w4gi2OdCLG"
    "1G8WW7t+AV2WzZrtq7PiSb48OKychD0cYh1bS4bwIAss6HritLdtmXiyfgpdsGBKuc8Q3urLy4WOLjdbaLsAsYe1JWWjy8SU"
    "2eIYhzDI7i+JW40m2kOs3Rqgy2xIw5IxTMl4nI0QvZDFwYy03uuxPIarCFJyUvs+WmZ8zDjNF1DYJApa02FxtBtvtuuwxWM5"
    "tYz0q+HMwjEiCIXwYpfvMBNpabt4dMLFYG0oBkoEtOyfiGy7nOhFsWggE2lpuNotyPxQbZPZstGfNFniZ5sJ4awS7aam37xc"
    "QQOV2K6o2xZKSO1HTT5h7ZN0GhrC1pcIgJsNoNhF1/wK4mbWhPlY0vNSYfCfHMw1sF/og1xFlllhus5fms5/bnjGTw8MIfi/"
    "Qm59oZ6NtnTn+XxQdbtjbOM2yUhRZkxZiW8TBc4tsYKC8NcLLzYDeLMlpkditibOl5qNLT8yJhzg0SrLRDaDZabjabbbrsMV"
    "oZtqjaMrN+Ht9BKiXpr4v+mWW22fG2xYS+04Qk4MvNyro7ZdxMItillgJtINxtFuRvN6Dqm9jyuz9nzMSafGfMQ5p8swQyA0"
    "2NBDjaPjh9MVsZsKDEk4z4bJwOhyxjiYe2mG8gWkBpFtmItt5LzZnaRmJAyxgsZbMvmLWXNFQApA5AWLvft+C+PNTJkD4mag"
    "OgxHem3Ra2m1osuytKDwUREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBERAREQEREBER"
    "AREQEREH/9k="
)


def tdiv(a, b):
    """C-style integer division (truncates toward zero), as in drive.h."""
    q = abs(a) // abs(b)
    return q if (a >= 0) == (b > 0) else -q


def clamp(v, lo, hi):
    return lo if v < lo else hi if v > hi else v


def pct_to_duty(pct, limit):
    return tdiv(clamp(pct, -100, 100) * clamp(limit, 0, 100) * DUTY_MAX, 10000)


def mix_arcade(x, y, limit):
    x, y = clamp(x, -100, 100), clamp(y, -100, 100)
    left, right = y + x, y - x
    peak = max(abs(left), abs(right))
    if peak > 100:
        left, right = tdiv(left * 100, peak), tdiv(right * 100, peak)
    return pct_to_duty(left, limit), pct_to_duty(right, limit)


def motion_duty(motion, speed):
    d = pct_to_duty(100, speed)
    s = pct_to_duty(SPIN_SCALE, speed)
    return {"forward": (d, d), "reverse": (-d, -d), "left": (-s, s), "right": (s, -s)}.get(motion, (0, 0))


def slew(cur, tgt, up, down):
    if cur == tgt:
        return cur
    same_side = (cur >= 0 and tgt >= 0) or (cur <= 0 and tgt <= 0)
    if same_side and abs(tgt) > abs(cur):
        return min(cur + up, tgt) if tgt > cur else max(cur - up, tgt)
    goal = tgt if same_side else 0
    return min(cur + down, goal) if goal > cur else max(cur - down, goal)


def parse_int(s, lo=-1000000, hi=1000000):
    try:
        v = int(s, 10)
    except ValueError:
        return None
    return v if lo <= v <= hi and s.strip() == s else None


class Robot:
    """Shared simulated robot state."""

    def __init__(self, args):
        self.args = args
        self.lock = threading.Lock()
        self.speed = 70
        self.light = 0
        self.cam = {"framesize": "vga", "quality": 12, "vflip": 0, "hmirror": 0}
        self.target = (0, 0)
        self.output = [0, 0]
        self.last_drive = 0.0
        self.driver = None
        self.failsafe = False
        self.clients = {}
        self.next_id = 1
        self.frames = 0
        self.fps = 0.0
        self.streaming = 0
        self.log = []
        self.started = time.time()

    # ------------------------------------------------------------------ messages
    def state_json(self):
        return json.dumps({
            "type": "state", "name": "telebot-mock", "fw": "mock", "ip": "127.0.0.1", "ap": False,
            "streamPort": self.args.port + 1, "tokenRequired": bool(self.args.token),
            "speed": self.speed, "light": self.light,
            "cam": dict(self.cam, ok=True, maxFramesize="svga"), "failsafeMs": self.args.failsafe_ms,
        })

    def telemetry_json(self):
        return json.dumps({
            "type": "telemetry", "uptime": int(time.time() - self.started), "rssi": -52, "heap": 150000,
            "psram": 4000000, "fps": round(self.fps, 1), "streaming": self.streaming > 0,
            "left": self.output[0], "right": self.output[1], "failsafe": self.failsafe,
            "clients": len(self.clients),
        })

    def broadcast(self, text):
        for client in list(self.clients.values()):
            client.send(text)

    # ------------------------------------------------------------------ commands
    def handle(self, client, text):
        with self.lock:
            self.log.append({"t": round(time.time(), 3), "client": client.id, "cmd": text})
            del self.log[:-200]
        if self.args.verbose and not text.startswith("ping"):
            print("  #%d %s" % (client.id, text), flush=True)
        parts = text.split()
        if not parts or len(parts) > 3 or len(text) > 63:
            return client.send('{"type":"error","msg":"bad command"}')
        verb, rest = parts[0], parts[1:]
        ok = True
        if verb in ("joy", "tank") and len(rest) == 2:
            a, b = parse_int(rest[0]), parse_int(rest[1])
            ok = a is not None and b is not None
            if ok:
                duty = mix_arcade(a, b, self.speed) if verb == "joy" else (pct_to_duty(a, self.speed), pct_to_duty(b, self.speed))
                self.set_target(duty, client.id)
        elif verb == "move" and len(rest) == 1 and rest[0] in ("forward", "reverse", "left", "right", "stop"):
            self.set_target(motion_duty(rest[0], self.speed), client.id)
        elif verb == "stop" and not rest:
            self.set_target((0, 0), client.id)
        elif verb in ("speed", "light") and len(rest) == 1 and parse_int(rest[0], 0, 100) is not None:
            setattr(self, verb, parse_int(rest[0]))
            self.broadcast(self.state_json())
        elif verb == "ping" and len(rest) == 1 and rest[0].isdigit():
            client.send('{"type":"pong","t":%s}' % rest[0])
        elif verb == "cam" and len(rest) == 2:
            ok = self.set_cam(*rest)
            if ok:
                self.broadcast(self.state_json())
            else:
                return client.send('{"type":"error","msg":"camera setting rejected"}')
        else:
            ok = False
        if not ok:
            client.send('{"type":"error","msg":"bad command"}')

    def set_cam(self, key, value):
        if key == "framesize":
            if value not in FRAME_SIZES:
                return False
            self.cam["framesize"] = value
            return True
        v = parse_int(value)
        if v is None:
            return False
        if key == "quality":
            self.cam["quality"] = clamp(v, 10, 63)
        elif key in ("vflip", "hmirror"):
            self.cam[key] = 1 if v else 0
        elif key != "brightness":
            return False
        return True

    def set_target(self, duty, client_id):
        with self.lock:
            self.target = duty
            self.last_drive = time.monotonic()
            self.driver = client_id

    def disconnected(self, client_id):
        with self.lock:
            self.clients.pop(client_id, None)
            if self.driver == client_id:
                self.target, self.driver = (0, 0), None

    # ------------------------------------------------------------------ loops
    def control_loop(self):
        while True:
            with self.lock:
                target = self.target
                expired = (time.monotonic() - self.last_drive) * 1000 > self.args.failsafe_ms
            if expired and target != (0, 0):
                self.failsafe = True
            if not expired:
                self.failsafe = False
            if expired:
                target = (0, 0)
            self.output = [slew(self.output[i], target[i], RAMP_UP, RAMP_DOWN) for i in (0, 1)]
            time.sleep(1 / CONTROL_HZ)

    def telemetry_loop(self):
        last_frames, last_t = 0, time.monotonic()
        while True:
            time.sleep(1)
            now = time.monotonic()
            self.fps = (self.frames - last_frames) / (now - last_t)
            last_frames, last_t = self.frames, now
            self.broadcast(self.telemetry_json())


class WsClient:
    def __init__(self, robot, wfile):
        self.wfile = wfile
        self.send_lock = threading.Lock()
        with robot.lock:
            self.id = robot.next_id
            robot.next_id += 1

    def send(self, text, opcode=0x1):
        payload = text.encode() if isinstance(text, str) else text
        n = len(payload)
        if n < 126:
            header = struct.pack("!BB", 0x80 | opcode, n)
        elif n < 65536:
            header = struct.pack("!BBH", 0x80 | opcode, 126, n)
        else:
            header = struct.pack("!BBQ", 0x80 | opcode, 127, n)
        try:
            with self.send_lock:
                self.wfile.write(header + payload)
                self.wfile.flush()
        except OSError:
            pass


def read_frame(rfile):
    head = rfile.read(2)
    if len(head) < 2:
        return None, None
    opcode, n = head[0] & 0x0F, head[1] & 0x7F
    if n == 126:
        n = struct.unpack("!H", rfile.read(2))[0]
    elif n == 127:
        n = struct.unpack("!Q", rfile.read(8))[0]
    mask = rfile.read(4) if head[1] & 0x80 else b"\0\0\0\0"
    data = bytearray(rfile.read(n))
    for i in range(len(data)):
        data[i] ^= mask[i % 4]
    return opcode, bytes(data)


def token_ok(robot, path):
    if not robot.args.token:
        return True
    return parse_qs(urlparse(path).query).get("token", [""])[0] == robot.args.token


def make_control_handler(robot):
    class Handler(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"

        def log_message(self, fmt, *a):
            if robot.args.verbose:
                sys.stderr.write("http: " + fmt % a + "\n")

        def reply(self, code, ctype, body):
            self.send_response(code)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            path = urlparse(self.path).path
            if path == "/ws" and self.headers.get("Upgrade", "").lower() == "websocket":
                return self.websocket()
            if path in ("/", "/index.html"):
                with open(DASHBOARD, "rb") as f:
                    return self.reply(200, "text/html; charset=utf-8", f.read())
            if path == "/status":
                return self.reply(200, "application/json", robot.state_json().encode())
            if path == "/debug/log":
                with robot.lock:
                    return self.reply(200, "application/json", json.dumps(robot.log).encode())
            self.reply(404, "text/plain", b"Not found")

        def websocket(self):
            if not token_ok(robot, self.path):
                return self.reply(401, "text/plain", b"token required")
            key = self.headers.get("Sec-WebSocket-Key", "")
            accept = base64.b64encode(hashlib.sha1((key + WS_GUID).encode()).digest()).decode()
            self.send_response(101, "Switching Protocols")
            self.send_header("Upgrade", "websocket")
            self.send_header("Connection", "Upgrade")
            self.send_header("Sec-WebSocket-Accept", accept)
            self.end_headers()
            self.wfile.flush()
            client = WsClient(robot, self.wfile)
            robot.clients[client.id] = client
            print("client #%d connected" % client.id, flush=True)
            client.send(robot.state_json())
            try:
                while True:
                    opcode, data = read_frame(self.rfile)
                    if opcode is None or opcode == 0x8:
                        break
                    if opcode == 0x9:
                        client.send(data, opcode=0xA)
                    elif opcode == 0x1:
                        robot.handle(client, data.decode("utf-8", "replace"))
            except (OSError, struct.error):
                pass
            finally:
                robot.disconnected(client.id)
                print("client #%d disconnected" % client.id, flush=True)
                self.close_connection = True

    return Handler


def make_stream_handler(robot):
    try:
        from PIL import Image, ImageDraw  # optional: animated overlay
    except ImportError:
        Image = None

    def frame():
        if Image is None:
            return TESTCARD_JPEG
        im = Image.open(io.BytesIO(TESTCARD_JPEG)).convert("RGB")
        if robot.cam["vflip"]:
            im = im.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
        if robot.cam["hmirror"]:
            im = im.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        d = ImageDraw.Draw(im)
        d.text((6, 4), time.strftime("%H:%M:%S"), fill=(255, 255, 255))
        d.text((6, 128), "L %4d  R %4d" % tuple(robot.output), fill=(34, 197, 94))
        if robot.light:
            d.rectangle([296, 4, 314, 16], fill=(253, 230, 138))
        out = io.BytesIO()
        im.save(out, "JPEG", quality=70)
        return out.getvalue()

    class Handler(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"

        def log_message(self, fmt, *a):
            pass

        def do_GET(self):
            path = urlparse(self.path).path
            if not token_ok(robot, self.path):
                self.send_response(401)
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Content-Length", "0")
                self.end_headers()
                return
            if path == "/capture":
                body = frame()
                self.send_response(200)
                self.send_header("Content-Type", "image/jpeg")
                self.send_header("Content-Length", str(len(body)))
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(body)
                return
            if path != "/stream":
                self.send_response(404)
                self.send_header("Content-Length", "0")
                self.end_headers()
                return
            self.send_response(200)
            self.send_header("Content-Type", "multipart/x-mixed-replace;boundary=telebotframe")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            robot.streaming += 1
            try:
                while True:
                    body = frame()
                    self.wfile.write(b"\r\n--telebotframe\r\nContent-Type: image/jpeg\r\nContent-Length: %d\r\n\r\n" % len(body))
                    self.wfile.write(body)
                    self.wfile.flush()
                    robot.frames += 1
                    time.sleep(1 / 12)
            except OSError:
                pass
            finally:
                robot.streaming -= 1
                self.close_connection = True

    return Handler


def main(argv=None):
    parser = argparse.ArgumentParser(description="Simulated TeleBot for dashboard development")
    parser.add_argument("--port", type=int, default=8080, help="dashboard + WebSocket port; the stream uses port+1")
    parser.add_argument("--bind", default="127.0.0.1", help="address to listen on (0.0.0.0 for phones on your LAN)")
    parser.add_argument("--token", default="", help="require ?token=... like ACCESS_TOKEN in the firmware")
    parser.add_argument("--failsafe-ms", type=int, default=500)
    parser.add_argument("-v", "--verbose", action="store_true", help="print every command")
    args = parser.parse_args(argv)

    robot = Robot(args)
    ThreadingHTTPServer.daemon_threads = True
    socketserver.TCPServer.allow_reuse_address = True
    control = ThreadingHTTPServer((args.bind, args.port), make_control_handler(robot))
    stream = ThreadingHTTPServer((args.bind, args.port + 1), make_stream_handler(robot))
    for target in (robot.control_loop, robot.telemetry_loop, stream.serve_forever):
        threading.Thread(target=target, daemon=True).start()
    shown = "localhost" if args.bind in ("127.0.0.1", "0.0.0.0") else args.bind
    print("mock robot: open http://%s:%d/  (stream on :%d)" % (shown, args.port, args.port + 1), flush=True)
    try:
        control.serve_forever()
    except KeyboardInterrupt:
        pass
    return 0


if __name__ == "__main__":
    sys.exit(main())
