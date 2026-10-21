import { ClickInput, ClickRecorder, DbClickRecorder } from '../../src/modules/tracking/click-recorder';

/** 리다이렉트 응답 뒤 비동기로 실행되는 클릭 기록이 끝날 때까지 기다릴 수 있게 감싼다 */
export class TrackedRecorder implements ClickRecorder {
  private pending = new Set<Promise<void>>();
  constructor(private readonly inner: ClickRecorder = new DbClickRecorder()) {}

  record(input: ClickInput): Promise<void> {
    const p = this.inner.record(input).finally(() => this.pending.delete(p));
    this.pending.add(p);
    return p;
  }

  async idle(): Promise<void> {
    // setImmediate로 예약된 기록이 시작되도록 한 틱 양보
    await new Promise(r => setImmediate(r));
    await Promise.allSettled([...this.pending]);
  }
}
