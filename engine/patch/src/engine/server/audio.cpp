#include "audio.hpp"
#include <cerrno>
#include <chrono>
#include <csignal>
#include <cstring>
#include <sys/types.h>
#include <sys/wait.h>
#include <unistd.h>

namespace relay {
AudioCapture::AudioCapture(Sink sink, std::string tool, std::string device)
  : sink_(std::move(sink)), tool_(std::move(tool)), device_(std::move(device)) {}

AudioCapture::~AudioCapture() { stop(); }

bool AudioCapture::start(std::string& error) {
  if (tool_.empty() || device_.empty()) {
    error = "Audio needs a capture tool and a monitor device";
    return false;
  }
  int pipe_fds[2] = {-1, -1};
  if (pipe(pipe_fds) != 0) {
    error = "Cannot create the audio pipe";
    return false;
  }
  const pid_t pid = fork();
  if (pid < 0) {
    close(pipe_fds[0]); close(pipe_fds[1]);
    error = "Cannot start the audio capture process";
    return false;
  }
  if (pid == 0) {
    dup2(pipe_fds[1], STDOUT_FILENO);
    close(pipe_fds[0]);
    close(pipe_fds[1]);
    const std::string device = "--device=" + device_;
    execl(tool_.c_str(), tool_.c_str(), "--raw", "--format=s16le", "--rate=48000",
          "--channels=2", "--latency-msec=20", "--client-name=relay-audio",
          device.c_str(), static_cast<char*>(nullptr));
    _exit(127);
  }
  close(pipe_fds[1]);
  pid_ = int(pid);
  stopping_ = false;
  {
    std::lock_guard<std::mutex> lock(mutex_);
    error_.clear();
  }
  const int read_fd = pipe_fds[0];
  worker_ = std::thread([this, read_fd] { run(read_fd); close(read_fd); });
  return true;
}

void AudioCapture::run(int read_fd) {
  const size_t chunk = format_.chunk_bytes;
  while (!stopping_) {
    std::vector<uint8_t> pcm(chunk);
    size_t filled = 0;
    while (filled < chunk && !stopping_) {
      const ssize_t count = read(read_fd, pcm.data() + filled, chunk - filled);
      if (count < 0) {
        if (errno == EINTR) continue;
        break;
      }
      if (count == 0) break;
      filled += size_t(count);
    }
    if (filled < chunk) break;
    const auto timestamp = std::chrono::duration_cast<std::chrono::microseconds>(
      std::chrono::system_clock::now().time_since_epoch()).count();
    sink_(std::move(pcm), uint64_t(timestamp));
  }
  const int status = pid_ > 0 ? [] (int pid) {
    int code = 0;
    waitpid(pid, &code, 0);
    return code;
  }(pid_) : 0;
  pid_ = -1;
  if (!stopping_) {
    std::lock_guard<std::mutex> lock(mutex_);
    error_ = "Audio capture stopped (exit " + std::to_string(status) + ")";
  }
}

void AudioCapture::stop() {
  if (!worker_.joinable()) {
    stopping_ = true;
    return;
  }
  stopping_ = true;
  if (pid_ > 0) kill(pid_, SIGTERM);
  worker_.join();
}

std::string AudioCapture::error() const {
  std::lock_guard<std::mutex> lock(mutex_);
  return error_;
}
}  // namespace relay
