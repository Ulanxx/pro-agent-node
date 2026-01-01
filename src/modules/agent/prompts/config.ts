import { TargetStage } from '../intent-classifier.service';
import {
  ANALYSIS_PROMPT,
  COURSE_CONFIG_PROMPT,
  VIDEO_OUTLINE_PROMPT,
  SLIDE_SCRIPT_PROMPT,
  THEME_GENERATION_PROMPT,
  SLIDE_PAGE_GENERATION_PROMPT,
} from './planning.prompt';

/**
 * Prompt 配置文件，方便统一维护和管理所有阶段的 Prompt
 */
export const AGENT_PROMPTS = {
  [TargetStage.ANALYSIS]: {
    prompt: ANALYSIS_PROMPT,
    description: '深入解析用户需求，提取核心意图和约束',
  },
  [TargetStage.COURSE_CONFIG]: {
    prompt: COURSE_CONFIG_PROMPT,
    description: '根据需求分析生成课程配置（受众、时长、教学目标等）',
  },
  [TargetStage.VIDEO_OUTLINE]: {
    prompt: VIDEO_OUTLINE_PROMPT,
    description: '根据课程配置生成结构化的视频/演示大纲',
  },
  [TargetStage.SLIDE_SCRIPTS]: {
    prompt: SLIDE_SCRIPT_PROMPT,
    description: '为大纲中的每一页生成详细的 PPT 脚本和口播稿',
  },
  [TargetStage.THEME]: {
    prompt: THEME_GENERATION_PROMPT,
    description: '生成 PPT 的视觉风格和主题配色',
  },
  [TargetStage.SLIDES]: {
    prompt: SLIDE_PAGE_GENERATION_PROMPT,
    description: '将脚本转化为高冲击力的 HTML 幻灯片页面',
  },
};
