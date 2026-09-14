import axios from 'axios';
import { VoxiqService } from './voxiq.service';

jest.mock('axios');

describe('VoxiqService', () => {
  const service = new VoxiqService();
  const post = axios.post as jest.Mock;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env.VOXIQ_BASE_URL = 'https://voxiq.bytechsol.com';
    process.env.VOXIQ_INTEGRATION_API_KEY = 'test-server-only-key';
  });

  it.each(['8605001016', '(860) 500-1016', '+08605001016', ''])(
    'rejects an invalid non-E.164 destination: %s',
    async destinationNumber => {
      await expect(service.createLaunchSession({ sub: 1 }, {
        destinationNumber,
        contactName: 'Customer',
        selectedOutboundNumber: '+18605001016',
      })).rejects.toThrow();
    },
  );

  it('only accepts approved outbound numbers', async () => {
    await expect(service.createLaunchSession({ sub: 1 }, {
      destinationNumber: '+18605001016',
      contactName: 'Customer',
      selectedOutboundNumber: '+15555555555',
    })).rejects.toThrow('Select an approved outgoing number');
  });

  it('accepts a valid E.164 destination', async () => {
    post.mockResolvedValue({ status: 200, data: { launchUrl: 'https://voxiq.bytechsol.com/agent?integration_session=one-time-token' } });

    await expect(service.createLaunchSession({ sub: 7 }, {
      destinationNumber: '+18605001016',
      contactName: 'Customer',
      selectedOutboundNumber: '+18605001016',
    })).resolves.toEqual({ launchUrl: 'https://voxiq.bytechsol.com/agent?integration_session=one-time-token' });
  });

  it('never sends browser or external-user identity data to Voxiq', async () => {
    post.mockResolvedValue({
      status: 200,
      data: { launchUrl: 'https://voxiq.bytechsol.com/agent?integration_session=one-time-token' },
    });

    await expect(service.createLaunchSession({ sub: 7 }, {
      destinationNumber: '+18605001016',
      contactName: 'Máría & Sons <Dispatch>',
      selectedOutboundNumber: '+19593333361',
      currentUser: { email: 'untrusted@example.com', name: 'Untrusted' },
    })).resolves.toEqual({ launchUrl: 'https://voxiq.bytechsol.com/agent?integration_session=one-time-token' });

    expect(post).toHaveBeenCalledWith(
      'https://voxiq.bytechsol.com/api/integrations/click-to-call/launch-session',
      expect.objectContaining({
        destinationNumber: '+18605001016',
        contactName: 'Máría & Sons <Dispatch>',
        selectedOutboundNumber: '+19593333361',
      }),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer test-server-only-key' }),
      }),
    );
    expect(post.mock.calls[0][1]).not.toHaveProperty('currentUser');
    expect(post.mock.calls[0][1]).not.toHaveProperty('externalUser');
    expect(post.mock.calls[0][1]).not.toHaveProperty('VOXIQ_INTEGRATION_API_KEY');
  });

  it('does not return or trust an unsafe launch URL', async () => {
    post.mockResolvedValue({ status: 200, data: { launchUrl: 'https://attacker.example/agent?token=bad' } });

    await expect(service.createLaunchSession({ sub: 7 }, {
      destinationNumber: '+18605001016',
      contactName: 'Customer',
      selectedOutboundNumber: '+18605001016',
    })).rejects.toThrow('Unable to create a Voxiq call session');
  });
});
