#include "CameraManager.hpp"
#include <cstdlib>
#include <filesystem>
#include <regex>
#include <sstream>
#include <stdexcept>
#ifdef CAMERA_WITH_OPENCV
#include <opencv2/imgcodecs.hpp>
#include <opencv2/videoio.hpp>
#endif

CameraManager::CameraManager() { refresh(); }
bool CameraManager::captureEnabled() {
#ifdef CAMERA_WITH_OPENCV
    return true;
#else
    return false;
#endif
}
void CameraManager::refresh() {
    devices_.clear();
    // An explicit list overrides discovery, including an empty list in tests.
    if (const char* value = std::getenv("CAMERA_DEVICE_INDICES")) {
        std::stringstream input(value);
        std::string part;
        while (std::getline(input, part, ',')) {
            if (!std::regex_match(part, std::regex("[0-9]{1,2}"))) continue;
            int index = std::stoi(part);
            devices_["camera-" + std::to_string(index)] = index;
        }
        return;
    }
#ifdef __linux__
    // Listing device nodes does not open a camera or start a recording.
    std::error_code error;
    for (const auto& entry : std::filesystem::directory_iterator("/dev", error)) {
        std::smatch match;
        const std::string name = entry.path().filename().string();
        if (std::regex_match(name, match, std::regex("video([0-9]{1,2})"))) {
            int index = std::stoi(match[1]);
            devices_["camera-" + std::to_string(index)] = index;
        }
    }
#endif
}
nlohmann::json CameraManager::discover() {
    std::lock_guard<std::mutex> lock(captureMutex_);
    refresh();
    auto list = nlohmann::json::array();
    for (const auto& [id, index] : devices_) {
        (void) index;
        list.push_back({{"id", id}, {"state", "detected"}, {"captureEnabled", captureEnabled()}});
    }
    return list;
}
nlohmann::json CameraManager::status(const std::string& id) {
    std::lock_guard<std::mutex> lock(captureMutex_);
    refresh();
    if (!devices_.count(id)) throw std::out_of_range("Camera not found");
    return {{"id", id}, {"state", captureEnabled() ? "detected" : "capture_disabled"},
            {"captureEnabled", captureEnabled()}, {"frameAvailable", nullptr}};
}
std::vector<unsigned char> CameraManager::snapshot(const std::string& id) {
    std::unique_lock<std::mutex> lock(captureMutex_, std::try_to_lock);
    if (!lock.owns_lock()) throw std::runtime_error("Camera busy");
    refresh();
    auto device = devices_.find(id);
    if (device == devices_.end()) throw std::out_of_range("Camera not found");
#ifdef CAMERA_WITH_OPENCV
    cv::VideoCapture capture(device->second);
    if (!capture.isOpened()) throw std::runtime_error("Camera unavailable");
    capture.set(cv::CAP_PROP_FRAME_WIDTH, 1280);
    capture.set(cv::CAP_PROP_FRAME_HEIGHT, 720);
    cv::Mat frame;
    if (!capture.read(frame) || frame.empty()) throw std::runtime_error("No frame available");
    std::vector<unsigned char> bytes;
    if (!cv::imencode(".jpg", frame, bytes, {cv::IMWRITE_JPEG_QUALITY, 80}))
        throw std::runtime_error("Snapshot encoding failed");
    if (bytes.size() > 5 * 1024 * 1024) throw std::runtime_error("Snapshot too large");
    return bytes;
#else
    throw std::runtime_error("Capture disabled in this build");
#endif
}
