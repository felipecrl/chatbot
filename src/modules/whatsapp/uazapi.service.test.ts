import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { AxiosInstance } from 'axios';

// Mock the config module
vi.mock('../../config', () => ({
  config: {
    whatsapp: { skipSend: false },
    uazapi: { baseUrl: 'https://api.uazapi.com', instanceToken: 'test-token' },
  },
}));

// Mock the logger
vi.mock('../../lib/logger', () => ({
  logger: {
    child: vi.fn(() => ({
      info: vi.fn(),
      debug: vi.fn(),
      error: vi.fn(),
    })),
  },
}));

// Mock the http-client creation
vi.mock('../../lib/http-client', () => ({
  createHttpClient: vi.fn(() => ({
    post: vi.fn(),
  })),
}));

import { UzapiWhatsAppService } from './uazapi.service';
import type { Property } from '../properties/property.types';

const mockProperty: Property = {
  code: 'AP001',
  type: 'Apartamento',
  transaction: 'venda',
  city: 'Belo Horizonte',
  neighborhood: 'Savassi',
  address: null,
  price: 450_000,
  area: 75,
  bedrooms: 2,
  bathrooms: 2,
  parkingSpaces: 1,
  amenities: ['Academia', 'Piscina'],
  description: 'Lindo apartamento.',
  photos: ['https://example.com/photo.jpg'],
};

describe('UzapiWhatsAppService', () => {
  let mockClient: AxiosInstance;
  let service: UzapiWhatsAppService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = {
      post: vi.fn().mockResolvedValue({ status: 200, data: { success: true } }),
    } as unknown as AxiosInstance;
  });

  describe('constructor', () => {
    it('uses the provided http client if given', () => {
      service = new UzapiWhatsAppService(mockClient);
      expect(service).toBeDefined();
    });
  });

  describe('sendText', () => {
    beforeEach(() => {
      service = new UzapiWhatsAppService(mockClient);
    });

    it('sends a text message via the uazapi endpoint', async () => {
      await service.sendText('5531999999999', 'Hello!');

      expect(mockClient.post).toHaveBeenCalledWith('/send/text', {
        number: '5531999999999',
        text: 'Hello!',
      });
    });

    it('strips @s.whatsapp.net from the "to" number', async () => {
      await service.sendText('5531999999999@s.whatsapp.net', 'Test');

      expect(mockClient.post).toHaveBeenCalledWith('/send/text', {
        number: '5531999999999',
        text: 'Test',
      });
    });

    it('strips @c.us from the "to" number', async () => {
      await service.sendText('5531999999999@c.us', 'Test');

      expect(mockClient.post).toHaveBeenCalledWith('/send/text', {
        number: '5531999999999',
        text: 'Test',
      });
    });

    it('propagates HTTP errors', async () => {
      const error = new Error('Network error');
      (mockClient.post as ReturnType<typeof vi.fn>).mockRejectedValueOnce(error);

      await expect(service.sendText('5531999999999', 'Test')).rejects.toThrow('Network error');
    });
  });

  describe('sendImage', () => {
    beforeEach(() => {
      service = new UzapiWhatsAppService(mockClient);
    });

    it('sends an image with caption via text endpoint (uazapi limitation)', async () => {
      const imageUrl = 'https://example.com/photo.jpg';
      const caption = 'Beautiful apartment';

      await service.sendImage('5531999999999', imageUrl, caption);

      expect(mockClient.post).toHaveBeenCalledWith('/send/text', {
        number: '5531999999999',
        text: `${caption}\n${imageUrl}`,
      });
    });

    it('sends image URL alone when no caption is provided', async () => {
      const imageUrl = 'https://example.com/photo.jpg';

      await service.sendImage('5531999999999', imageUrl);

      expect(mockClient.post).toHaveBeenCalledWith('/send/text', {
        number: '5531999999999',
        text: imageUrl,
      });
    });
  });

  describe('sendProperty', () => {
    beforeEach(() => {
      service = new UzapiWhatsAppService(mockClient);
    });

    it('sends property with photo as image + caption', async () => {
      await service.sendProperty('5531999999999', mockProperty);

      expect(mockClient.post).toHaveBeenCalled();
    });

    it('sends property without photo as text', async () => {
      const propertyWithoutPhoto = { ...mockProperty, photos: [] };

      await service.sendProperty('5531999999999', propertyWithoutPhoto);

      expect(mockClient.post).toHaveBeenCalledWith('/send/text', expect.any(Object));
    });

    it('uses the first photo if available', async () => {
      const propertyWithMultiplePhotos = {
        ...mockProperty,
        photos: ['https://example.com/photo1.jpg', 'https://example.com/photo2.jpg'],
      };

      await service.sendProperty('5531999999999', propertyWithMultiplePhotos);

      expect(mockClient.post).toHaveBeenCalled();
    });
  });

  describe('sendProperties', () => {
    beforeEach(() => {
      service = new UzapiWhatsAppService(mockClient);
      vi.useFakeTimers();
    });

    it('sends multiple properties with delay between each', async () => {
      const properties = [mockProperty, { ...mockProperty, code: 'AP002' }];

      const sendPromise = service.sendProperties('5531999999999', properties);
      await vi.advanceTimersByTimeAsync(2000);
      await sendPromise;

      expect(mockClient.post).toHaveBeenCalledTimes(2);
    });

    it('continues sending even if one property fails', async () => {
      const properties = [
        mockProperty,
        { ...mockProperty, code: 'AP002' },
        { ...mockProperty, code: 'AP003' },
      ];

      (mockClient.post as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ status: 200 })
        .mockRejectedValueOnce(new Error('Failed to send AP002'))
        .mockResolvedValueOnce({ status: 200 });

      const sendPromise = service.sendProperties('5531999999999', properties);
      await vi.advanceTimersByTimeAsync(3000);
      await sendPromise;

      expect(mockClient.post).toHaveBeenCalledTimes(3);
    });
  });

  describe('markAsRead', () => {
    beforeEach(() => {
      service = new UzapiWhatsAppService(mockClient);
    });

    it('is a no-op (uazapi does not support marking as read)', async () => {
      await expect(service.markAsRead('msg-123')).resolves.toBeUndefined();
      expect(mockClient.post).not.toHaveBeenCalled();
    });
  });
});
