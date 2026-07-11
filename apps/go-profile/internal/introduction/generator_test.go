package introduction

import (
	"strings"
	"testing"

	"github.com/fashiontai/bhb-login/apps/go-profile/internal/github"
)

func TestGenerateChineseIntroduction(t *testing.T) {
	profile := github.Profile{Login: "fashiontai", Name: "Tai", PublicRepos: 12, Followers: 8, Location: "Tokyo"}
	result := Generate(profile, "zh-CN")

	for _, expected := range []string{"Tai", "@fashiontai", "12", "Tokyo"} {
		if !strings.Contains(result, expected) {
			t.Fatalf("expected %q in generated introduction: %s", expected, result)
		}
	}
}

func TestGenerateEnglishIntroduction(t *testing.T) {
	profile := github.Profile{Login: "fashiontai", PublicRepos: 3, Followers: 2}
	result := Generate(profile, "en-US")

	if !strings.Contains(result, "is a GitHub developer") {
		t.Fatalf("unexpected generated introduction: %s", result)
	}
}
