package main

import (
	"fmt"
	"os"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

// Helper to get environment variable with fallback
func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	return fallback
}

// SetupCORS configures CORS settings dynamically to allow localhost and vercel/railway urls.
func SetupCORS() fiber.Handler {
	allowedOrigins := []string{
		"http://localhost:5173",
		"http://localhost:3000",
		"https://evtakip.vercel.app",
	}

	return func(c *fiber.Ctx) error {
		origin := c.Get("Origin")
		if origin == "" {
			return c.Next()
		}

		isAllowed := false
		for _, o := range allowedOrigins {
			if o == origin {
				isAllowed = true
				break
			}
		}

		if !isAllowed {
			if strings.HasPrefix(origin, "http://localhost:") || strings.HasSuffix(origin, ".up.railway.app") {
				isAllowed = true
			}
		}

		frontendURL := getEnv("FRONTEND_URL", "https://ev-takip-frontend.vercel.app")
		if !isAllowed && origin == frontendURL {
			isAllowed = true
		}

		if isAllowed {
			c.Set("Access-Control-Allow-Origin", origin)
			c.Set("Access-Control-Allow-Credentials", "true")
			c.Set("Access-Control-Allow-Headers", "Origin, Content-Type, Accept, Authorization")
			c.Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		}

		if c.Method() == "OPTIONS" {
			return c.SendStatus(fiber.StatusNoContent)
		}

		return c.Next()
	}
}

// AuthMiddleware extracts JWT and verifies it, injecting user details into locals
func AuthMiddleware(jwtSecret string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		authHeader := c.Get("Authorization")
		if authHeader == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Yetkilendirme başlığı bulunamadı."})
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Token bulunamadı."})
		}

		tokenString := parts[1]
		token, err := jwt.Parse(tokenString, func(t *jwt.Token) (interface{}, error) {
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
			}
			return []byte(jwtSecret), nil
		})

		if err != nil || !token.Valid {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Geçersiz veya süresi dolmuş token."})
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Geçersiz veya süresi dolmuş token."})
		}

		idVal, ok := claims["id"]
		if !ok {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Geçersiz token içeriği."})
		}

		idFloat, ok := idVal.(float64)
		if !ok {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Geçersiz token içeriği."})
		}

		c.Locals("userID", uint(idFloat))
		c.Locals("userEposta", claims["eposta"])
		return c.Next()
	}
}
