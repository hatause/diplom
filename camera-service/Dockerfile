FROM debian:bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends cmake g++ ca-certificates libopencv-dev make && rm -rf /var/lib/apt/lists/*
WORKDIR /src
COPY . .
RUN cmake -S . -B build -DCMAKE_BUILD_TYPE=Release && cmake --build build -j2
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends libopencv-videoio406 libopencv-imgcodecs406 && rm -rf /var/lib/apt/lists/* && useradd -r -u 10001 camera
COPY --from=build /src/build/camera-service /usr/local/bin/camera-service
USER camera
ENV CAMERA_HOST=0.0.0.0
EXPOSE 8088
CMD ["camera-service"]
