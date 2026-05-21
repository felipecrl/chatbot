import { describe, expect, it } from 'vitest';
import { buildOffTopicReply } from './topic-guard';

describe('buildOffTopicReply', () => {
  it('returns a string message', () => {
    const reply = buildOffTopicReply();
    expect(typeof reply).toBe('string');
    expect(reply.length).toBeGreaterThan(0);
  });

  it('includes company name and city from config', () => {
    const reply = buildOffTopicReply();
    expect(reply).toContain('assistente da');
    expect(reply).toContain('especializado em imóveis');
    expect(reply).toContain('Está procurando um imóvel em');
  });

  it('mentions imóvel-related services', () => {
    const reply = buildOffTopicReply();
    expect(reply).toContain('busca');
    expect(reply).toContain('agendamento de visitas');
  });

  it('uses emoji for friendliness', () => {
    const reply = buildOffTopicReply();
    expect(reply).toContain('😊');
  });

  it('has clear line breaks for readability', () => {
    const reply = buildOffTopicReply();
    const lines = reply.split('\n\n');
    expect(lines.length).toBeGreaterThanOrEqual(3);
  });
});
