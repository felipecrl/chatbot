import axios, { AxiosError, type AxiosInstance, type CreateAxiosDefaults } from 'axios';
import { ExternalServiceError } from './errors';
import { logger } from './logger';

export interface HttpClientOptions extends CreateAxiosDefaults {
  /** Logical name of the upstream service, used in logs and errors. */
  serviceName: string;
}

/**
 * Builds a pre-configured axios instance:
 *  - sane default timeout
 *  - debug logging of requests / responses
 *  - upstream errors normalised to {@link ExternalServiceError}
 */
export function createHttpClient({
  serviceName,
  timeout = 10_000,
  ...axiosConfig
}: HttpClientOptions): AxiosInstance {
  const instance = axios.create({ timeout, ...axiosConfig });
  const log = logger.child({ httpClient: serviceName });

  instance.interceptors.request.use((request) => {
    log.debug('request', { method: request.method, url: request.url });
    return request;
  });

  instance.interceptors.response.use(
    (response) => {
      log.debug('response', { url: response.config.url, status: response.status });
      return response;
    },
    (error: unknown) => {
      if (error instanceof AxiosError) {
        const status = error.response?.status;
        const responseData: unknown = error.response?.data;
        log.error('request failed', {
          url: error.config?.url,
          status,
          data: responseData,
          message: error.message,
        });
        throw new ExternalServiceError(
          serviceName,
          `Falha ao comunicar com ${serviceName}${status ? ` (HTTP ${status})` : ''}`,
          { cause: error, details: responseData },
        );
      }
      throw error;
    },
  );

  return instance;
}
