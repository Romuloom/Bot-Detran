import * as puppeteer from "puppeteer";
import * as dotenv from "dotenv";
import { resolveCaptchaV2 } from "./captchaService";

dotenv.config();

const RENAVAM = process.env.RENAVAM ?? "";
const CPF = process.env.CPF ?? "";

if (!RENAVAM) {
  throw new Error("RENAVAM não está definido no arquivo .env");
}

if (!CPF) {
  throw new Error("CPF não está definido no arquivo .env");
}

export async function accessDetranPage() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  try {
    const url =
      "https://www.detran.rj.gov.br/_monta_aplicacoes.asp?cod=11&tipo=consulta_multa";
    await page.goto(url, { waitUntil: "networkidle2" });

    // Acessando o iframe pelo ID "frameConsulta"
    const frameHandle = await page.waitForSelector("#frameConsulta", {
      timeout: 10000,
    });
    const frame = await frameHandle?.contentFrame();

    if (!frame) {
      console.error("Iframe 'frameConsulta' não encontrado!");
      return;
    }

    // Preencher o campo RENAVAM
    const renavamInput = await frame.waitForSelector("#MultasRenavam", {
      timeout: 10000,
    });
    await renavamInput?.type(RENAVAM);

    // Preencher o campo CPF/CNPJ
    const cpfInput = await frame.waitForSelector("#MultasCpfcnpj", {
      timeout: 10000,
    });
    await cpfInput?.type(CPF);

    // Resolver o CAPTCHA
    const siteKey = "6LfP47IUAAAAAIwbI5NOKHyvT9Pda17dl0nXl4xv";
    const captchaResponse = await resolveCaptchaV2(siteKey, url);

    if (!captchaResponse) {
      console.error("Falha ao obter o TOKEN do CAPTCHA.");
      return;
    }

    // Preencher o valor do CAPTCHA resolvido
    await frame.evaluate((captchaResponse) => {
      const captchaElement = document.querySelector(
        "#g-recaptcha-response"
      ) as HTMLTextAreaElement;
      if (captchaElement) {
        captchaElement.value = captchaResponse;
        captchaElement.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }, captchaResponse);

    console.log("ReCAPTCHA preenchido.");

    // Clicar no botão de consultar
    const consultButton = await frame.waitForSelector("#btPesquisar", {
      timeout: 10000,
    });
    await consultButton?.click();

    // Esperar pela presença do container que contém a tabela de resultados no contexto do iframe.
    console.log("Aguardando a tabela de resultados aparecer...");
    await frame.waitForSelector("#caixaTabela", { timeout: 120000 });
    console.log("Tabela de resultados carregada.");

    // Extrair os dados da tabela da página de resultados
    const extractedData = await extractDataFromFrame(frame);
  } catch (error) {
    console.error("Erro ao acessar a página do Detran RJ:", error);
  } finally {
    console.log("Fechando navegador.");
    await browser.close();
  }
}

// Função para extrair dados da tabela a partir do contexto do iframe
async function extractDataFromFrame(frame: puppeteer.Frame) {
  try {
    console.log("Iniciando a extração dos dados da tabela...");

    // Extraindo os dados da tabela usando frame.evaluate
    const data = await frame.evaluate(() => {
      const table = document.querySelector(
        ".tabelaDescricao"
      ) as HTMLTableElement;
      if (!table) {
        console.error("Tabela não encontrada no contexto do iframe.");
        throw new Error("Tabela não encontrada na página.");
      }

      const rows = table.querySelectorAll("tr");
      const result: { [key: string]: string } = {};

      // Função auxiliar para pegar o texto de um elemento
      const getText = (element: Element | null): string =>
        (element as HTMLElement)?.innerText?.trim() || "";

      // Mapeando os dados que queremos extrair
      result["autoInfracao"] = getText(
        rows[1].querySelector("td:nth-child(1)")
      ).replace("Auto de Infração:\n", "");
      result["autoRenainf"] = getText(
        rows[1].querySelector("td:nth-child(2)")
      ).replace("Auto de Renainf:\n", "");
      result["dataPagamentoDesconto"] = getText(
        rows[1].querySelector("td:nth-child(3)")
      ).replace("Data para pagamento com desconto:\n", "");

      result["enquadramentoInfracao"] = getText(
        rows[2].querySelector("td:nth-child(1)")
      ).replace("Enquadramento da Infração:\n", "");
      result["dataInfracao"] = getText(
        rows[2].querySelector("td:nth-child(3)")
      ).replace("Data da Infração:\n", "");
      result["horaInfracao"] = getText(
        rows[2].querySelector("td:nth-child(4)")
      ).replace("Hora:\n", "");

      result["descricao"] = getText(
        rows[3].querySelector("td:nth-child(1)")
      ).replace("Descrição:\n", "");
      result["placaRelacionada"] = getText(
        rows[3].querySelector("td:nth-child(4)")
      ).replace("Placa Relacionada:\n", "");

      result["localInfracao"] = getText(
        rows[4].querySelector("td:nth-child(1)")
      ).replace("Local da Infração:\n", "");
      result["valorOriginal"] = getText(
        rows[4].querySelector("td:nth-child(3)")
      ).replace("Valor original R$:\n", "");
      result["valorPago"] = getText(
        rows[4].querySelector("td:nth-child(4)")
      ).replace("Valor a ser pago R$:\n", "");

      result["statusPagamento"] = getText(
        rows[5].querySelector("td:nth-child(1)")
      ).replace("Status de Pagamento:\n", "");
      result["orgaoEmissor"] = getText(
        rows[5].querySelector("td:nth-child(2)")
      ).replace("Órgão Emissor:\n", "");
      result["agenteEmissor"] = getText(
        rows[5].querySelector("td:nth-child(3)")
      ).replace("Agente Emissor:\n", "");

      return result;
    });

    console.log("Dados extraídos da tabela:", data);
    return data;
  } catch (error) {
    console.error("Erro ao extrair os dados da tabela:", error);
    return null;
  }
}
