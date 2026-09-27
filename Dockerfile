# syntax=docker/dockerfile:1

# ============================================================
# verify：一次性服务镜像。容器启动即依次执行
#   代码测试 → 构建 → 骨架样例冒烟，以退出码报告结果。
# ============================================================
FROM node:22-alpine AS verify
WORKDIR /src
COPY app ./app
COPY tests ./tests
COPY verify ./verify
COPY build.js ./
CMD ["sh", "-c", "node tests/run-tests.js && node build.js && node verify/smoke.js"]

# ============================================================
# build：静态站点构建（产出 dist/）
# ============================================================
FROM node:22-alpine AS build
WORKDIR /src
COPY app ./app
COPY build.js ./
RUN node build.js

# ============================================================
# web：静态 Web（nginx），/healthz 供健康检查
# ============================================================
FROM nginx:1.27-alpine AS web
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/dist /usr/share/nginx/html
EXPOSE 80
