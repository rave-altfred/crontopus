# Multi-stage build for Crontopus Agent
# Stage 1: Build
FROM golang:1.21-alpine AS builder

# Install git (needed for go modules)
RUN apk add --no-cache git

WORKDIR /build

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build the binary
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo \
    -ldflags="-w -s" \
    -o crontopus-agent \
    ./cmd/crontopus-agent

# Stage 2: Runtime
FROM alpine:3.19

# Install ca-certificates for HTTPS, git for repository operations, and cron
RUN apk --no-cache add \
    ca-certificates \
    git \
    curl \
    tzdata

# Create non-root user
RUN addgroup -g 1000 crontopus && \
    adduser -D -u 1000 -G crontopus crontopus

WORKDIR /app

# Copy binary from builder
COPY --from=builder /build/crontopus-agent .

# Copy example config
COPY config.example.yaml config.yaml

# Create directories for agent data
RUN mkdir -p /app/.crontopus && \
    chown -R crontopus:crontopus /app

USER crontopus

# Run agent
CMD ["./crontopus-agent", "--config", "config.yaml"]
