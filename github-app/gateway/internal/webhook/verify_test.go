package webhook

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"testing"
)

func sign(secret string, body []byte) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	return "sha256=" + hex.EncodeToString(mac.Sum(nil))
}

func TestVerifySignature_ok(t *testing.T) {
	body := []byte(`{"zen":"test"}`)
	secret := "s3cret"
	if !VerifySignature(secret, body, sign(secret, body)) {
		t.Fatal("expected valid signature")
	}
}

func TestVerifySignature_bad(t *testing.T) {
	body := []byte(`{"zen":"test"}`)
	if VerifySignature("s3cret", body, "sha256=deadbeef") {
		t.Fatal("expected invalid signature")
	}
	if VerifySignature("s3cret", body, "") {
		t.Fatal("expected empty header to fail")
	}
}