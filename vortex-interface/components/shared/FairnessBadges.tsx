"use client";

import { Shield, Star, Users, Zap, Award } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface FairnessBadge {
  id: string;
  name: string;
  description: string;
  icon: "shield" | "star" | "users" | "zap" | "award";
  color: string;
}

const BADGE_ICONS = {
  shield: Shield,
  star: Star,
  users: Users,
  zap: Zap,
  award: Award,
};

const BADGE_DEFINITIONS: Record<string, FairnessBadge> = {
  "Early Adopter": {
    id: "early-adopter",
    name: "Early Adopter",
    description: "Joined Vortex during launch phase",
    icon: "star",
    color: "hsl(var(--primary))",
  },
  "Fair Lender": {
    id: "fair-lender",
    name: "Fair Lender",
    description: "Maintained high fairness score across orders",
    icon: "shield",
    color: "hsl(var(--success))",
  },
  "Community Builder": {
    id: "community-builder",
    name: "Community Builder",
    description: "Contributed to ecosystem stability",
    icon: "users",
    color: "hsl(var(--accent))",
  },
  "Priority Member": {
    id: "priority-member",
    name: "Priority Member",
    description: "Active vesting vault participant",
    icon: "zap",
    color: "hsl(var(--warning))",
  },
  "Top Performer": {
    id: "top-performer",
    name: "Top Performer",
    description: "Achieved exceptional lending results",
    icon: "award",
    color: "hsl(var(--primary))",
  },
};

interface FairnessBadgesProps {
  badges: string[];
  size?: "sm" | "md" | "lg";
  showLabels?: boolean;
  maxDisplay?: number;
}

export function FairnessBadges({ 
  badges, 
  size = "md", 
  showLabels = false,
  maxDisplay = 5 
}: FairnessBadgesProps) {
  const sizeClasses = {
    sm: "w-6 h-6",
    md: "w-8 h-8",
    lg: "w-10 h-10",
  };

  const iconSizes = {
    sm: "w-3 h-3",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  };

  const displayBadges = badges.slice(0, maxDisplay);
  const remainingCount = badges.length - maxDisplay;

  if (badges.length === 0) {
    return null;
  }

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1.5 flex-wrap">
        {displayBadges.map((badgeName) => {
          const badge = BADGE_DEFINITIONS[badgeName];
          if (!badge) return null;

          const Icon = BADGE_ICONS[badge.icon];

          return (
            <Tooltip key={badge.id}>
              <TooltipTrigger asChild>
                <div
                  className={`${sizeClasses[size]} rounded-lg flex items-center justify-center cursor-pointer transition-transform hover:scale-110`}
                  style={{ backgroundColor: `${badge.color}20` }}
                >
                  <Icon 
                    className={iconSizes[size]} 
                    style={{ color: badge.color }}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent 
                side="top" 
                className="bg-[hsl(var(--card))] border-[hsl(var(--border))]"
              >
                <div className="text-center">
                  <p className="font-medium text-[hsl(var(--foreground))]">{badge.name}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">{badge.description}</p>
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}

        {remainingCount > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={`${sizeClasses[size]} rounded-lg flex items-center justify-center cursor-pointer bg-[hsl(var(--secondary))]`}
              >
                <span className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
                  +{remainingCount}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent 
              side="top" 
              className="bg-[hsl(var(--card))] border-[hsl(var(--border))]"
            >
              <p className="text-sm text-[hsl(var(--foreground))]">
                {remainingCount} more badge{remainingCount > 1 ? "s" : ""}
              </p>
            </TooltipContent>
          </Tooltip>
        )}

        {showLabels && displayBadges.length > 0 && (
          <span className="text-xs text-[hsl(var(--muted-foreground))] ml-1">
            {displayBadges.length} badge{displayBadges.length > 1 ? "s" : ""}
          </span>
        )}
      </div>
    </TooltipProvider>
  );
}

interface FairnessScoreBadgeProps {
  score: number;
  size?: "sm" | "md" | "lg";
}

export function FairnessScoreBadge({ score, size = "md" }: FairnessScoreBadgeProps) {
  const getScoreColor = (s: number) => {
    if (s >= 90) return "hsl(var(--success))";
    if (s >= 70) return "hsl(var(--primary))";
    if (s >= 50) return "hsl(var(--warning))";
    return "hsl(var(--muted-foreground))";
  };

  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-3 py-1 text-sm",
    lg: "px-4 py-1.5 text-base",
  };

  const color = getScoreColor(score);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={`${sizeClasses[size]} rounded-full font-medium cursor-pointer inline-flex items-center gap-1.5`}
            style={{ 
              backgroundColor: `${color}20`,
              color: color,
            }}
          >
            <Shield className="w-3 h-3" />
            <span>{score}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent 
          side="top" 
          className="bg-[hsl(var(--card))] border-[hsl(var(--border))]"
        >
          <div className="text-center max-w-[200px]">
            <p className="font-medium text-[hsl(var(--foreground))]">Fairness Score</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              AI-verified score based on order size, retail priority, and risk diversity
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
