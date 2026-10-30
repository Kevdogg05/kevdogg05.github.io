// Minimal stand-in for the Unity test framework, covering only the macros the
// firmware tests use. It lets `make test` run the drive-logic tests with a
// plain C++ compiler; `pio test -e native` uses the real Unity.
#pragma once

#include <stdint.h>
#include <stdio.h>
#include <string.h>

static int unity_failures = 0;
static int unity_tests = 0;
static int unity_current_failed = 0;

#define UNITY_FAIL_AT(msg, ...)                                                   \
  do {                                                                            \
    printf("  %s:%d: FAIL: " msg "\n", __FILE__, __LINE__, ##__VA_ARGS__);       \
    unity_current_failed = 1;                                                     \
  } while (0)

#define TEST_ASSERT_TRUE(cond) \
  do { if (!(cond)) UNITY_FAIL_AT("expected true: %s", #cond); } while (0)
#define TEST_ASSERT_FALSE(cond) \
  do { if (cond) UNITY_FAIL_AT("expected false: %s", #cond); } while (0)
#define TEST_ASSERT_EQUAL_INT(expected, actual)                                            \
  do {                                                                                     \
    long long e_ = (long long)(expected), a_ = (long long)(actual);                        \
    if (e_ != a_) UNITY_FAIL_AT("%s: expected %lld, got %lld", #actual, e_, a_);           \
  } while (0)
#define TEST_ASSERT_EQUAL_UINT8(expected, actual) TEST_ASSERT_EQUAL_INT((uint8_t)(expected), (uint8_t)(actual))
#define TEST_ASSERT_EQUAL_UINT32(expected, actual) TEST_ASSERT_EQUAL_INT((uint32_t)(expected), (uint32_t)(actual))
#define TEST_ASSERT_EQUAL_STRING(expected, actual)                                               \
  do {                                                                                           \
    if (strcmp((expected), (actual)) != 0)                                                       \
      UNITY_FAIL_AT("%s: expected \"%s\", got \"%s\"", #actual, (expected), (actual));           \
  } while (0)

#define UNITY_BEGIN() (unity_failures = 0, unity_tests = 0)
#define RUN_TEST(fn)                                                  \
  do {                                                                \
    unity_current_failed = 0;                                         \
    setUp();                                                          \
    fn();                                                             \
    tearDown();                                                       \
    ++unity_tests;                                                    \
    if (unity_current_failed) ++unity_failures;                       \
    printf("%s %s\n", unity_current_failed ? "FAIL" : "PASS", #fn);   \
  } while (0)
#define UNITY_END() \
  (printf("\n%d tests, %d failures\n", unity_tests, unity_failures), unity_failures)
