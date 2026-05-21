import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { AxiosInstance } from 'axios';
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
    mockClient = {
      post: vi.fn().mockResolvedValue({ status: 200, data: { success: true } }),
    } as unknown as AxiosInstance;

    vi.spyOn(require('../../config'), 'config', 'get').mockReturnValue({
      whatsapp: { skipSend: false },
      uazapi: { baseUrl: 'https://api.uazapi.com', instanceToken: 'test-token' },
    });
  });

  describe('constructor', () => {
    it('uses the provided http client if given', () => {
      service = new UzapiWhatsAppService(mockClient);
      expect(service).toBeDefined();
    });

    it('creates an http client if none is provided', () => {
      vi.mock('../../lib/http-client', () => ({
        createHttpClient: vi.fn().mockReturnValue({
          post: vi.fn(),
        }),
      }));

      service = new UzapiWhatsAppService();
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

    it('skips sending when skipSend config is true', async () => {
      vi.spyOn(require('../../config'), 'config', 'get').mockReturnValue({
        whatsapp: { skipSend: true },
        uazapi: { baseUrl: 'https://api.uazapi.com', instanceToken: 'test-token' },
      });

      service = new UzapiWhatsAppService(mockClient);
      await service.sendText('5531999999999', 'Test');

      expect(mockClient.post).not.toHaveBeenCalled();
    });

    it('propagates HTTP errors', async () => {
      const error = new Error('Network error');
      (mockClient.post as ReturnType<typeof vi.fn>).mockRejectedValue(error);

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

    it('respects skipSend config', async () => {
      vi.spyOn(require('../../config'), 'config', 'get').mockReturnValue({
        whatsapp: { skipSend: true },
        uazapi: { baseUrl: 'https://api.uazapi.com', instanceToken: 'test-token' },
      });

      service = new UzapiWhatsAppService(mockClient);
      await service.sendImage('5531999999999', 'https://example.com/photo.jpg', 'Caption');

      expect(mockClient.post).not.toHaveBeenCalled();
    });
  });

  describe('sendProperty', () => {
    beforeEach(() => {
      service = new UzapiWhatsAppService(mockClient);
    });

    it('sends property with photo as image + caption', async () => {
      await service.sendProperty('5531999999999', mockProperty);

      expect(mockClient.post).toHaveBeenCalledWith('/send/text', {
        number: '5531999999999',
        text: expect.stringContaining('Apartamento'),
      });
    });

    it('sends property without photo as text', async () => {
      const propertyWithoutPhoto = { ...mockProperty, photos: [] };

      await service.sendProperty('5531999999999', propertyWithoutPhoto);

      expect(mockClient.post).toHaveBeenCalledWith('/send/text', expect.any(Object));
    });

    it('uses the first photo if available', async () => {
      const propertyWithMultiplePhotos = {
        ...mockProperty,
        photos: [
          'https://example.com/photo1.jpg',
          'https://example.com/photo2.jpg',
        ],
      };

      await service.sendProperty('5531999999999', propertyWithMultiplePhotos);

      // Should call with photo endpoint (text endpoint in uazapi case)
      expect(mockClient.post).toHaveBeenCalled();
    });
  });

  describe('sendProperties', () => {
    beforeEach(() => {
      service = new UzapiWhatsAppService(mockClient);
      vi.useFakeTimers();
    });

    it('sends multiple properties with delay between each', async () => {
      const properties = [
        mockProperty,
        { ...mockProperty, code: 'AP002' },
      ];

      const sendPromise = service.sendProperties('5531999999999', properties);
      await vi.advanceTimersByTimeAsync(2000); // 1s delay per property
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

      // Should have attempted all 3 even though one failed
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
