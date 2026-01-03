/**
 * DSL（领域特定语言）类型定义
 *
 * 该文件定义了 Pro-Agent 项目的核心数据结构和类型，用于描述 PPT 生成的各个阶段。
 *
 * 主要包含：
 * - 布局配置（LayoutConfig）：定义组件在幻灯片中的位置和样式
 * - 组件类型（TextComponent、ChartComponent）：幻灯片中的可渲染元素
 * - 幻灯片结构（SlidePage、AnyGenDocument）：完整的幻灯片和文档结构
 * - PPT 生成相关类型（CourseConfig、VideoOutline、SlideScript 等）：描述 PPT 生成的各个阶段
 *
 * 所有类型都使用 Zod 进行验证，确保数据的完整性和一致性。
 */

import { z } from 'zod';

/**
 * 布局配置 Schema
 * 定义组件在幻灯片中的位置和尺寸
 */
export const LayoutConfigSchema = z.object({
  // 画布布局模式：使用绝对定位（x, y, w, h 为百分比）
  canvas: z
    .object({
      x: z.number().min(0).max(100), // X 轴位置（0-100%）
      y: z.number().min(0).max(100), // Y 轴位置（0-100%）
      w: z.number().min(0).max(100), // 宽度（0-100%）
      h: z.number().min(0).max(100), // 高度（0-100%）
      zIndex: z.number(), // 层级顺序
    })
    .optional(),
  // 流式布局模式：使用对齐方式和内边距
  flow: z
    .object({
      align: z.enum(['left', 'center', 'right']), // 对齐方式
      padding: z.array(z.number()).optional(), // 内边距 [上, 右, 下, 左]
    })
    .optional(),
});

/**
 * 基础组件 Schema
 * 所有幻灯片组件的基类
 */
export const BaseComponentSchema = z.object({
  id: z.string(),
  type: z.enum(['text', 'image', 'chart']),
  layout: LayoutConfigSchema,
});

export const TextComponentSchema = BaseComponentSchema.extend({
  type: z.literal('text'),
  data: z.object({
    content: z.string(),
    role: z.enum(['title', 'subtitle', 'body']),
  }),
  style: z
    .object({
      color: z.string().optional(),
      fontSize: z.number().optional(),
    })
    .optional(),
});

export const ChartComponentSchema = BaseComponentSchema.extend({
  type: z.literal('chart'),
  data: z.object({
    chartType: z.enum(['bar', 'line', 'pie']),
    title: z.string(),
    labels: z.array(z.string()),
    datasets: z.array(
      z.object({
        label: z.string(),
        values: z.array(z.number()),
      }),
    ),
  }),
});

export const SlidePlanSchema = z.object({
  title: z.string(),
  description: z.string(),
  expectedComponents: z.array(z.enum(['text', 'image', 'chart'])),
  keyPoints: z.array(z.string()),
});

export const TaskStatusSchema = z.enum([
  'pending',
  'in_progress',
  'completed',
  'failed',
]);

export const ProcessTaskSchema = z.object({
  id: z.string(),
  content: z.string(),
  status: TaskStatusSchema,
});

export const DocumentPlanSchema = z.object({
  tasks: z.array(ProcessTaskSchema).optional(),
});

export const AnyComponentSchema = z.discriminatedUnion('type', [
  TextComponentSchema,
  ChartComponentSchema,
]);

export const SlidePageSchema = z.object({
  id: z.string(),
  meta: z.object({
    title: z.string(),
    speakNotes: z.string().optional(),
    background: z.string().optional(),
  }),
  elements: z.array(AnyComponentSchema),
});

export const AnyGenDocumentSchema = z.object({
  title: z.string(),
  meta: z.object({
    theme: z.string(),
    aspectRatio: z.literal('16:9'),
  }),
  pages: z.array(SlidePageSchema),
});

export type LayoutMode = 'canvas' | 'flow';
export type ComponentType = z.infer<typeof BaseComponentSchema>['type'];
export type LayoutConfig = z.infer<typeof LayoutConfigSchema>;
export type BaseComponent = z.infer<typeof BaseComponentSchema>;
export type TextComponent = z.infer<typeof TextComponentSchema>;
export type ChartComponent = z.infer<typeof ChartComponentSchema>;
export type AnyComponent = z.infer<typeof AnyComponentSchema>;
export type SlidePage = z.infer<typeof SlidePageSchema>;
export type AnyGenDocument = z.infer<typeof AnyGenDocumentSchema>;
export type SlidePlan = z.infer<typeof SlidePlanSchema>;
export type DocumentPlan = z.infer<typeof DocumentPlanSchema>;

/**
 * 课程配置 Schema
 * 定义 PPT 的基本配置信息
 */
export const CourseConfigSchema = z.object({
  narrativeStyle: z.string(), // 叙事风格（如：正式、轻松、专业等）
  targetAudience: z.string(), // 目标受众（如：学生、专业人士、大众等）
  duration: z.string(), // 预期时长
  objectives: z.array(z.string()), // 学习目标
  expectedPageCount: z.number().describe('预期生成的 PPT 总页数'),
});

/**
 * 知识点 Schema
 * 定义单个知识点的结构
 */
export const KnowledgePointSchema = z.object({
  title: z.string(), // 知识点标题
  description: z.string(), // 知识点描述
});

/**
 * 知识单元 Schema
 * 定义知识单元的结构，包含多个知识点
 */
export const KnowledgeUnitSchema = z.object({
  title: z.string(), // 知识单元标题
  description: z.string(), // 知识单元描述
  knowledgePoints: z.array(KnowledgePointSchema), // 包含的知识点列表
});

/**
 * 视频大纲 Schema
 * 定义 PPT 的整体结构和内容组织
 */
export const VideoOutlineSchema = z.object({
  theme: z.string(), // 主题
  knowledgeUnits: z.array(KnowledgeUnitSchema), // 知识单元列表
});

/**
 * 幻灯片脚本 Schema
 * 定义单个幻灯片的详细内容
 */
export const SlideScriptSchema = z.object({
  slideIndex: z.number(), // 幻灯片索引
  type: z.enum(['title', 'content', 'closing']), // 幻灯片类型
  title: z.string(), // 幻灯片标题
  content: z.union([z.string(), z.array(z.string())]), // 内容（可以是字符串或字符串数组）
  contentDesign: z.string(), // 内容设计说明
  visualSuggestions: z.string(), // 视觉建议
  narrationScript: z.string(), // 讲解脚本
});

/**
 * 配色方案 Schema
 * 定义 PPT 的颜色配置
 */
export const ColorSchemeSchema = z.object({
  primary: z.string(), // 主色调
  secondary: z.string(), // 次要色调
  accent: z.string(), // 强调色
  background: z.string(), // 背景色
  text: z.string(), // 文本颜色
});

/**
 * 字体配置 Schema
 * 定义 PPT 的字体设置
 */
export const FontConfigSchema = z.object({
  titleFont: z.string(), // 标题字体
  bodyFont: z.string(), // 正文字体
  titleSize: z.number(), // 标题字号
  bodySize: z.number(), // 正文字号
});

/**
 * 母版幻灯片 Schema
 * 定义幻灯片母版的布局
 */
export const MasterSlideSchema = z.object({
  type: z.enum(['title', 'content', 'section']), // 母版类型
  layout: z.string(), // 布局名称
});

/**
 * 演示文稿主题 Schema
 * 定义 PPT 的整体主题风格
 */
export const PresentationThemeSchema = z.object({
  themeName: z.string(), // 主题名称
  designStyle: z.string(), // 设计风格
  colorScheme: ColorSchemeSchema, // 配色方案
  fontConfig: FontConfigSchema, // 字体配置
  masterSlides: z.array(MasterSlideSchema), // 母版幻灯片列表
});

/**
 * 幻灯片 HTML Schema
 * 定义单个幻灯片的 HTML 表示
 */
export const SlideHtmlSchema = z.object({
  slideIndex: z.number(), // 幻灯片索引
  html: z.string(), // HTML 内容
  speakNotes: z.string().optional(), // 讲解备注（可选）
});

/**
 * PPT HTML 文档 Schema
 * 定义完整的 PPT HTML 文档
 */
export const PptHtmlDocumentSchema = z.object({
  title: z.string(), // 文档标题
  pages: z.array(SlideHtmlSchema), // 幻灯片页面列表
});

export type SlideHtml = z.infer<typeof SlideHtmlSchema>;
export type PptHtmlDocument = z.infer<typeof PptHtmlDocumentSchema>;

/**
 * Artifact（工件）Schema
 * 定义 PPT 生成过程中产生的各种中间结果和最终产物
 *
 * 工件类型包括：
 * - plan: 任务计划
 * - dsl: DSL 结构定义
 * - ppt_html: 单个幻灯片的 HTML
 * - ppt_html_doc: 完整的 PPT HTML 文档
 * - pptx: 最终的 PPTX 文件
 * - search_result: 网络搜索结果
 * - web_page: 网页内容
 * - requirement_analysis: 需求分析结果
 * - course_config: 课程配置
 * - video_outline: 视频大纲
 * - slide_scripts: 幻灯片脚本
 * - presentation_theme: 演示文稿主题
 */
export const ArtifactSchema = z.object({
  id: z.string(),
  type: z.enum([
    'plan',
    'dsl',
    'ppt_html',
    'ppt_html_doc',
    'pptx',
    'search_result',
    'web_page',
    'requirement_analysis',
    'course_config',
    'video_outline',
    'slide_scripts',
    'presentation_theme',
  ]),
  content: z.any(),
  version: z.string(),
  timestamp: z.number(),
});

export type CourseConfig = z.infer<typeof CourseConfigSchema>;
export type KnowledgePoint = z.infer<typeof KnowledgePointSchema>;
export type KnowledgeUnit = z.infer<typeof KnowledgeUnitSchema>;
export type VideoOutline = z.infer<typeof VideoOutlineSchema>;
export type SlideScript = z.infer<typeof SlideScriptSchema>;
export type ColorScheme = z.infer<typeof ColorSchemeSchema>;
export type FontConfig = z.infer<typeof FontConfigSchema>;
export type MasterSlide = z.infer<typeof MasterSlideSchema>;
export type PresentationTheme = z.infer<typeof PresentationThemeSchema>;
export type Artifact = z.infer<typeof ArtifactSchema>;
