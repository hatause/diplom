#pragma once
#include <map>
#include <mutex>
#include <string>
#include <vector>
#include <nlohmann/json.hpp>

class CameraManager {
public:
    CameraManager();
    nlohmann::json discover();
    nlohmann::json status(const std::string& id);
    std::vector<unsigned char> snapshot(const std::string& id);
    static bool captureEnabled();
private:
    std::map<std::string, int> devices_;
    std::mutex captureMutex_;
    void refresh();
};
