FROM --platform=$BUILDPLATFORM golang:1.26-alpine AS build

ARG TARGETARCH
ARG TARGETOS

WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH go build -trimpath -ldflags="-s -w" -o /out/go-profile ./cmd/api

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/go-profile /go-profile
EXPOSE 8080
USER nonroot:nonroot
ENTRYPOINT ["/go-profile"]
