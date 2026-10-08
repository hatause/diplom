#include "ApiServer.hpp"
#include <stdexcept>

static bool equalToken(const std::string& a, const std::string& b) {
    if (a.size() != b.size()) return false;
    unsigned char difference = 0;
    for (size_t i = 0; i < a.size(); ++i) difference |= a[i] ^ b[i];
    return difference == 0;
}
ApiServer::ApiServer(const std::string& token) {
    if (token.size() < 32) throw std::invalid_argument("CAMERA_SERVICE_TOKEN must contain at least 32 characters");
    server_.new_task_queue = [] { return new httplib::ThreadPool(4); };
    server_.set_read_timeout(5, 0);
    server_.set_write_timeout(5, 0);
    server_.set_payload_max_length(1024);
    server_.set_pre_routing_handler([token](const auto& req, auto& res) {
        res.set_header("Cache-Control", "no-store");
        res.set_header("X-Content-Type-Options", "nosniff");
        if (req.path != "/health" && !equalToken(req.get_header_value("Authorization"), "Bearer " + token)) {
            res.status = 401;
            res.set_content(R"({"error":"Unauthorized"})", "application/json");
            return httplib::Server::HandlerResponse::Handled;
        }
        return httplib::Server::HandlerResponse::Unhandled;
    });
    server_.Get("/health", [](const auto&, auto& res) {
        res.set_content(nlohmann::json({{"status", "ok"}, {"captureEnabled", CameraManager::captureEnabled()}}).dump(), "application/json");
    });
    server_.Get("/cameras", [this](const auto&, auto& res) {
        res.set_content(nlohmann::json({{"cameras", cameras_.discover()}}).dump(), "application/json");
    });
    server_.Get(R"(/cameras/(camera-[0-9]{1,2}))", [this](const auto& req, auto& res) {
        res.set_content(cameras_.status(req.matches[1]).dump(), "application/json");
    });
    server_.Get(R"(/cameras/(camera-[0-9]{1,2})/snapshot)", [this](const auto& req, auto& res) {
        const auto jpeg = cameras_.snapshot(req.matches[1]);
        res.set_content(reinterpret_cast<const char*>(jpeg.data()), jpeg.size(), "image/jpeg");
    });
    server_.set_exception_handler([](const auto&, auto& res, std::exception_ptr error) {
        try { if (error) std::rethrow_exception(error); }
        catch (const std::out_of_range&) { res.status = 404; }
        catch (...) { res.status = 503; }
        res.set_content(res.status == 404 ? R"({"error":"Camera not found"})" : R"({"error":"Camera unavailable"})", "application/json");
    });
}
bool ApiServer::listen(const std::string& host, int port) { return server_.listen(host, port); }
