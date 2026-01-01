import { Injectable } from '@nestjs/common';
import { AnyGenDocument } from '../../core/dsl/types';
import { PptAdapter } from './adapters/ppt.adapter';

@Injectable()
export class RenderService {
  private pptAdapter = new PptAdapter();

  async renderToPpt(doc: AnyGenDocument): Promise<Buffer> {
    return this.pptAdapter.render(doc);
  }
}
