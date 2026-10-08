#pragma once
#include "CameraManager.hpp"
#include <httplib.h>
class ApiServer {
public:
    explicit ApiServer(const std::string& token);
    bool listen(const std::string& host, int port);
private:
    CameraManager cameras_;
    httplib::Server server_;
};
