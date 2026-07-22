# 1. Aşama: Derleme (Build) Aşaması
FROM golang:1.26-alpine AS builder

# Gerekli sistem araçlarını yükle
RUN apk update && apk add --no-cache git

WORKDIR /app

# Bağımlılıkları kopyala ve indir
COPY go.mod go.sum ./
RUN go mod download

# Kaynak kodları kopyala ve statically-linked linux binary olarak derle
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o server .

# 2. Aşama: Çalıştırma (Run) Aşaması (Son derece hafif ve güvenli Alpine container)
FROM alpine:3.19

RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app

# Kalıcı veritabanı dizini oluştur ve tanımla
RUN mkdir -p /app/data
ENV DATABASE_PATH=/app/data/database.sqlite

# Derlenen çalıştırılabilir dosyayı builder aşamasından kopyala
COPY --from=builder /app/server .

# Port yapılandırması
EXPOSE 5000

# Uygulamayı başlat
CMD ["./server"]
