import { config } from '../../config';

export function buildOffTopicReply(): string {
  const { companyName, companyCity } = config.chatbot;
  return (
    `Olá! Sou o assistente da ${companyName} e sou especializado em imóveis. 😊\n\n` +
    `Só consigo ajudar com assuntos relacionados a imóveis — busca, preços, ` +
    `agendamento de visitas e muito mais!\n\n` +
    `Está procurando um imóvel em ${companyCity}?`
  );
}
