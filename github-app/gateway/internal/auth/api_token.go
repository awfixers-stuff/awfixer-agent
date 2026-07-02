package auth

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"fmt"
	"strconv"
	"strings"

	"golang.org/x/crypto/argon2"
)

const (
	argonTime    = 1
	argonMemory  = 64 * 1024
	argonThreads = 4
	argonKeyLen  = 32
	argonSaltLen = 16
)

// HashAPIToken returns an Argon2id PHC string for storing in api_tokens.token_hash.
func HashAPIToken(plain string) (string, error) {
	salt := make([]byte, argonSaltLen)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}
	hash := argon2.IDKey([]byte(plain), salt, argonTime, argonMemory, argonThreads, argonKeyLen)
	b64Salt := base64.RawStdEncoding.EncodeToString(salt)
	b64Hash := base64.RawStdEncoding.EncodeToString(hash)
	return fmt.Sprintf("$argon2id$v=19$m=%d,t=%d,p=%d$%s$%s",
		argonMemory, argonTime, argonThreads, b64Salt, b64Hash), nil
}

// VerifyAPIToken checks plain against a stored Argon2id PHC hash.
func VerifyAPIToken(plain, phc string) bool {
	salt, params, expected, ok := parsePHC(phc)
	if !ok {
		return false
	}
	actual := argon2.IDKey([]byte(plain), salt, params.time, params.memory, params.threads, uint32(len(expected)))
	return subtle.ConstantTimeCompare(actual, expected) == 1
}

type argonParams struct {
	memory  uint32
	time    uint32
	threads uint8
}

func parsePHC(phc string) (salt []byte, params argonParams, hash []byte, ok bool) {
	if !strings.HasPrefix(phc, "$argon2id$") {
		return nil, argonParams{}, nil, false
	}
	parts := strings.Split(phc, "$")
	if len(parts) != 6 {
		return nil, argonParams{}, nil, false
	}
	for _, kv := range strings.Split(parts[3], ",") {
		kv = strings.TrimSpace(kv)
		if kv == "" {
			continue
		}
		key, val, found := strings.Cut(kv, "=")
		if !found {
			return nil, argonParams{}, nil, false
		}
		n, err := strconv.ParseUint(val, 10, 32)
		if err != nil {
			return nil, argonParams{}, nil, false
		}
		switch key {
		case "m":
			params.memory = uint32(n)
		case "t":
			params.time = uint32(n)
		case "p":
			params.threads = uint8(n)
		default:
			return nil, argonParams{}, nil, false
		}
	}
	var err error
	salt, err = base64.RawStdEncoding.DecodeString(parts[4])
	if err != nil {
		return nil, argonParams{}, nil, false
	}
	hash, err = base64.RawStdEncoding.DecodeString(parts[5])
	if err != nil {
		return nil, argonParams{}, nil, false
	}
	return salt, params, hash, true
}