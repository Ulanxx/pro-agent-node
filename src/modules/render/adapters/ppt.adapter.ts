import pptxgen from 'pptxgenjs';
import {
  AnyGenDocument,
  AnyComponent,
  TextComponent,
  ChartComponent,
  SlidePage,
  PresentationTheme,
} from '../../../core/dsl/types';

export class PptAdapter {
  async render(
    doc: AnyGenDocument,
    theme?: PresentationTheme,
  ): Promise<Buffer> {
    const pres = new pptxgen();

    pres.layout =
      doc.meta.aspectRatio === '16:9' ? 'LAYOUT_16x9' : 'LAYOUT_4x3';
    pres.title = doc.title;

    if (theme) {
      this.applyTheme(pres, theme);
    }

    for (const page of doc.pages) {
      this.addSlide(pres, page, theme);
    }

    const buffer = await pres.write({ outputType: 'nodebuffer' });
    return buffer as Buffer;
  }

  private applyTheme(pres: pptxgen, theme: PresentationTheme) {
    pres.author = 'AnyGenAgent';
    pres.subject = theme.themeName;
  }

  private addSlide(pres: pptxgen, page: SlidePage, theme?: PresentationTheme) {
    const slide = pres.addSlide();

    if (page.meta.background) {
      slide.background = { fill: page.meta.background };
    } else if (theme) {
      slide.background = { fill: theme.colorScheme.background };
    }

    if (page.meta.speakNotes) {
      slide.addNotes(page.meta.speakNotes);
    }

    for (const element of page.elements) {
      this.renderElement(pres, slide, element, theme);
    }
  }

  private renderElement(
    pres: pptxgen,
    slide: pptxgen.Slide,
    element: AnyComponent,
    theme?: PresentationTheme,
  ) {
    const { layout } = element;
    if (!layout.canvas) return;

    const x = `${layout.canvas.x}%`;
    const y = `${layout.canvas.y}%`;
    const w = `${layout.canvas.w}%`;
    const h = `${layout.canvas.h}%`;

    switch (element.type) {
      case 'text':
        this.renderText(slide, element, { x, y, w, h }, theme);
        break;
      case 'chart':
        this.renderChart(pres, slide, element, { x, y, w, h }, theme);
        break;
    }
  }

  private renderText(
    slide: pptxgen.Slide,
    element: TextComponent,
    pos: any,
    theme?: PresentationTheme,
  ) {
    const { data, style } = element;

    const defaultFontSize =
      data.role === 'title'
        ? theme?.fontConfig.titleSize || 32
        : theme?.fontConfig.bodySize || 18;

    const defaultColor = theme
      ? theme.colorScheme.text.replace('#', '')
      : '000000';

    slide.addText(data.content, {
      x: pos.x,
      y: pos.y,
      w: pos.w,
      h: pos.h,
      fontSize: style?.fontSize || defaultFontSize,
      color: style?.color || defaultColor,
      bold: data.role === 'title',
      align: data.role === 'title' ? 'center' : 'left',
      valign: 'middle',
      fontFace:
        data.role === 'title'
          ? theme?.fontConfig.titleFont
          : theme?.fontConfig.bodyFont,
    });
  }

  private renderChart(
    pres: pptxgen,
    slide: pptxgen.Slide,
    element: ChartComponent,
    pos: any,
    theme?: PresentationTheme,
  ) {
    const { data } = element;

    const chartData = data.datasets.map((ds, index) => ({
      name: ds.label,
      labels: data.labels,
      values: ds.values,
      color: theme
        ? index === 0
          ? theme.colorScheme.primary
          : theme.colorScheme.secondary
        : undefined,
    }));

    let chartType: pptxgen.ChartType;
    switch (data.chartType) {
      case 'bar':
        chartType = pres.ChartType.bar;
        break;
      case 'line':
        chartType = pres.ChartType.line;
        break;
      case 'pie':
        chartType = pres.ChartType.pie;
        break;
      default:
        chartType = pres.ChartType.bar;
    }

    slide.addChart(chartType, chartData, {
      x: pos.x,
      y: pos.y,
      w: pos.w,
      h: pos.h,
      showTitle: true,
      title: data.title,
    });
  }
}
