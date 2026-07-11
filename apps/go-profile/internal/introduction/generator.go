package introduction

import (
	"fmt"
	"strings"

	"github.com/fashiontai/bhb-login/apps/go-profile/internal/github"
)

func Generate(profile github.Profile, locale string) string {
	name := profile.Name
	if name == "" {
		name = profile.Login
	}

	if locale == "en-US" {
		parts := []string{fmt.Sprintf("%s (@%s) is a GitHub developer with %d public repositories and %d followers.", name, profile.Login, profile.PublicRepos, profile.Followers)}
		if profile.Bio != "" {
			parts = append(parts, profile.Bio)
		}
		if profile.Company != "" {
			parts = append(parts, fmt.Sprintf("Currently connected with %s.", profile.Company))
		}
		if profile.Location != "" {
			parts = append(parts, fmt.Sprintf("Based in %s.", profile.Location))
		}
		return strings.Join(parts, " ")
	}

	parts := []string{fmt.Sprintf("%s（@%s）是一名活跃在 GitHub 的开发者，拥有 %d 个公开仓库和 %d 位关注者。", name, profile.Login, profile.PublicRepos, profile.Followers)}
	if profile.Bio != "" {
		parts = append(parts, profile.Bio)
	}
	if profile.Company != "" {
		parts = append(parts, fmt.Sprintf("目前与 %s 有关联。", profile.Company))
	}
	if profile.Location != "" {
		parts = append(parts, fmt.Sprintf("所在地：%s。", profile.Location))
	}
	return strings.Join(parts, "")
}
