package webhook

import "testing"

func TestVerifySignature_ok(t *testing.T) {
	body := []byte(`{"zen":"test"}`)
	secret := "s3cret"
	if !VerifySignature(secret, body, SignBody(secret, body)) {
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