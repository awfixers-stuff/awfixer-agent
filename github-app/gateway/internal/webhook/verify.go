package webhook

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"strings"
)

// VerifySignature checks GitHub X-Hub-Signature-256 (sha256=<hex>).
func VerifySignature(secret string, body []byte, signatureHeader string) bool {
	if secret == "" || signatureHeader == "" || !strings.HasPrefix(signatureHeader, "sha256=") {
		return false
	}
	provided := strings.TrimPrefix(signatureHeader, "sha256=")
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	expected := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(expected), []byte(provided))
}