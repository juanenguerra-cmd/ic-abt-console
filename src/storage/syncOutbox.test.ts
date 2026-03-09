
import { hasOutboxItems } from './syncOutbox';

describe('Sync Outbox', () => {
  it('should check if there are outbox items', async () => {
    const result = await hasOutboxItems();
    console.log('Sync status:', result ? 'Not all items are synced' : 'All items are synced');
  });
});
