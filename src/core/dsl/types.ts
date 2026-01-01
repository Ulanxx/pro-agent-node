import { z } from 'zod';

export const LayoutConfigSchema = z.object({
  canvas: z
    .object({
      x: z.number().min(0).max(100),
      y: z.number().min(0).max(100),
      w: z.number().min(0).max(100),
      h: z.number().min(0).max(100),
      zIndex: z.number(),
    })
    .optional(),
  flow: z
    .object({
      align: z.enum(['left', 'center', 'right']),
      padding: z.array(z.number()).optional(),
    })
    .optional(),
});

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

export const CourseConfigSchema = z.object({
  narrativeStyle: z.string(),
  targetAudience: z.string(),
  duration: z.string(),
  objectives: z.array(z.string()),
  expectedPageCount: z.number().describe('预期生成的 PPT 总页数'),
});

export const KnowledgePointSchema = z.object({
  title: z.string(),
  description: z.string(),
});

export const KnowledgeUnitSchema = z.object({
  title: z.string(),
  description: z.string(),
  knowledgePoints: z.array(KnowledgePointSchema),
});

export const VideoOutlineSchema = z.object({
  theme: z.string(),
  knowledgeUnits: z.array(KnowledgeUnitSchema),
});

export const SlideScriptSchema = z.object({
  slideIndex: z.number(),
  type: z.enum(['title', 'content', 'closing']),
  title: z.string(),
  content: z.union([z.string(), z.array(z.string())]),
  contentDesign: z.string(),
  visualSuggestions: z.string(),
  narrationScript: z.string(),
});

export const ColorSchemeSchema = z.object({
  primary: z.string(),
  secondary: z.string(),
  accent: z.string(),
  background: z.string(),
  text: z.string(),
});

export const FontConfigSchema = z.object({
  titleFont: z.string(),
  bodyFont: z.string(),
  titleSize: z.number(),
  bodySize: z.number(),
});

export const MasterSlideSchema = z.object({
  type: z.enum(['title', 'content', 'section']),
  layout: z.string(),
});

export const PresentationThemeSchema = z.object({
  themeName: z.string(),
  designStyle: z.string(),
  colorScheme: ColorSchemeSchema,
  fontConfig: FontConfigSchema,
  masterSlides: z.array(MasterSlideSchema),
});

export const SlideHtmlSchema = z.object({
  slideIndex: z.number(),
  html: z.string(),
  speakNotes: z.string().optional(),
});

export const PptHtmlDocumentSchema = z.object({
  title: z.string(),
  pages: z.array(SlideHtmlSchema),
});

export type SlideHtml = z.infer<typeof SlideHtmlSchema>;
export type PptHtmlDocument = z.infer<typeof PptHtmlDocumentSchema>;

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
