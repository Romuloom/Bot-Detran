// src/detranService.ts
import * as puppeteer from "puppeteer";
import { resolveCaptchaV2 } from "./captchaService";

export async function accessDetranPage() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  try {
    const url =
      "https://www.detran.rj.gov.br/_monta_aplicacoes.asp?cod=11&tipo=consulta_multa";
    await page.goto(url, { waitUntil: "networkidle2" });

    const frameHandle = await page.waitForSelector("iframe");
    const frame = await frameHandle?.contentFrame();

    if (!frame) {
      console.error("Iframe não encontrado!");
      return;
    }

    const renavamInput = await frame.waitForSelector("#MultasRenavam", {
      timeout: 10000,
    });
    await renavamInput?.type("00531492290");

    const cpfInput = await frame.waitForSelector("#MultasCpfcnpj", {
      timeout: 10000,
    });
    await cpfInput?.type("13210189757");

    const siteKey = "6LfP47IUAAAAAIwbI5NOKHyvT9Pda17dl0nXl4xv";
    const captchaResponse = await resolveCaptchaV2(siteKey, url);

    if (!captchaResponse) {
      console.error("Falha ao obter o TOKEN do CAPTCHA.");
      return;
    }

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

    const consultButton = await frame.waitForSelector("#btPesquisar", {
      timeout: 10000,
    });
    await consultButton?.click();

    await page.waitForNavigation({ waitUntil: "networkidle0", timeout: 60000 });
    console.log("Consulta realizada com sucesso!");
  } catch (error) {
    console.error("Erro ao acessar a página do Detran RJ:", error);
  } finally {
    console.log("Fechando navegador.");
    await browser.close();
  }
}
