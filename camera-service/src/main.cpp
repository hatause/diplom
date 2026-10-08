#include "ApiServer.hpp"
#include <cstdlib>
#include <iostream>
static std::string env(const char* name, const char* fallback) { const char* value = std::getenv(name); return value ? value : fallback; }
int main() {
    try {
        const int port = std::stoi(env("CAMERA_PORT", "8088"));
        if (port < 1 || port > 65535) throw std::invalid_argument("Invalid port");
        ApiServer server(env("CAMERA_SERVICE_TOKEN", ""));
        std::cout << "Aituto camera service on port " << port << std::endl;
        return server.listen(env("CAMERA_HOST", "127.0.0.1"), port) ? 0 : 1;
    } catch (const std::exception&) {
        std::cerr << "Camera service could not start. Check port and CAMERA_SERVICE_TOKEN (minimum 32 characters)." << std::endl;
        return 1;
    }
}
