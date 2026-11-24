#pragma once

#include <atomic>
#include <cstdint>
#include <functional>
#include <mutex>
#include <string>
#include <thread>
#include <vector>

namespace relay {
/** Fixed audio format shared with the viewer: 20 ms of s16le stereo at 48 kHz. */
struct AudioFormat {
  uint32_t sample_rate = 48000;
  uint8_t channels = 2;
  size_t chunk_bytes = 3840;
};

/**
 * Captures the default sink monitor through a `parec` child process. The
 * engine bundles parec beside the viewer, so no host installation is needed.
 * Capture failures never stop video; the caller reports audio as unavailable.
 */
class AudioCapture {
 public:
  using Sink = std::function<void(std::vector<uint8_t>&& pcm, uint64_t timestamp_us)>;
  AudioCapture(Sink sink, std::string tool, std::string device);
  ~AudioCapture();
  AudioCapture(const AudioCapture&) = delete;
  AudioCapture& operator=(const AudioCapture&) = delete;
  bool start(std::string& error);
  void stop();
  std::string error() const;
  const AudioFormat& format() const { return format_; }

 private:
  void run(int read_fd);
  Sink sink_;
  std::string tool_, device_;
  AudioFormat format_;
  std::thread worker_;
  std::atomic<bool> stopping_{false};
  int pid_ = -1;
  mutable std::mutex mutex_;
  std::string error_;
};
}  // namespace relay
