// Contenido de la política de privacidad, embebido para mostrarse dentro de
// la app (no depende de red ni del cold-start de Render). Debe reflejar el
// mismo contenido que backend/privacidad.html (la URL pública que exige
// Google en la ficha de Play Console) — si se actualiza uno, actualizar el
// otro. PT e IT son traducciones de trabajo; conviene una revisión legal
// antes de publicar la app en esos mercados.
export interface SeccionLegal {
  h2: string;
  parrafos?: string[];
  items?: string[];
}

export interface DocLegal {
  titulo: string;
  fecha: string;
  intro: string;
  secciones: SeccionLegal[];
}

export const PRIVACIDAD: Record<"es" | "en" | "pt" | "it", DocLegal> = {
  es: {
    titulo: "Política de Privacidad de RenuevAI",
    fecha: "Última actualización: 20 de julio de 2026",
    intro: `RenuevAI ("la app", "nosotros") es una aplicación que transforma fotografías de espacios reales usando inteligencia artificial. Esta política explica qué datos tratamos, para qué, con quién los compartimos y cuáles son tus derechos. Al usar RenuevAI aceptas lo aquí descrito.`,
    secciones: [
      {
        h2: "1. Datos que tratamos",
        items: [
          "Fotos que subes: las imágenes de tus espacios (o de referencia) se envían a nuestros servidores y a nuestros proveedores de IA únicamente para generar tu transformación. No las usamos para publicidad ni para entrenar modelos.",
          "Identificador de dispositivo anónimo: generamos un identificador aleatorio (no vinculado a tu nombre) para aplicar los límites de uso diarios y, si corresponde, tu suscripción. No requerimos registro ni cuenta.",
          "Dirección IP: se procesa de forma temporal como medida de seguridad contra abuso del servicio.",
          "Datos de uso: categoría usada, fecha de la generación y estado del trabajo, para operar la app y controlar costos.",
          'Texto que escribes al asistente "El Maestro": se envía a nuestro proveedor de IA para responderte; no se asocia a tu identidad.',
          "Identificador de publicidad y datos de anuncios: en la versión gratuita mostramos anuncios mediante Google AdMob, que puede usar el identificador de publicidad del dispositivo (ver sección 3).",
          "Compras: las suscripciones se procesan por Google Play; no recibimos ni almacenamos datos de tu tarjeta.",
        ],
        parrafos: ["No recopilamos nombre, correo, teléfono, contactos, ubicación precisa ni datos de salud o financieros."],
      },
      {
        h2: "2. Para qué usamos los datos",
        items: [
          "Generar y mostrarte tus transformaciones de imagen y video.",
          "Guardar tu historial para que puedas volver a verlo (puedes borrarlo).",
          "Aplicar los límites de uso y, si eres Premium, desbloquear tus beneficios.",
          "Prevenir abuso y fraude del servicio.",
          "Mostrar anuncios en la versión gratuita.",
        ],
      },
      {
        h2: "3. Proveedores con los que compartimos datos",
        parrafos: ["Para prestar el servicio, ciertos datos se procesan por terceros, cada uno con su propia política de privacidad:"],
        items: [
          "Replicate — generación de imágenes y video (recibe tus fotos para procesarlas).",
          'Groq — asistente de texto "El Maestro".',
          "Supabase — almacenamiento de los resultados y base de datos.",
          "Render — alojamiento del servidor.",
          "Google AdMob — publicidad en la versión gratuita; puede usar el identificador de publicidad.",
          "Google Play — procesamiento de las suscripciones.",
        ],
      },
      {
        h2: "4. Conservación y eliminación",
        parrafos: [
          'Tus resultados se conservan mientras uses la app. Puedes eliminar cualquier transformación desde la sección "Recientes". Si deseas eliminar todos tus datos asociados a tu identificador de dispositivo, escríbenos (ver contacto) indicando tu ID de dispositivo, que encuentras en Ajustes → Mi cuenta.',
        ],
      },
      {
        h2: "5. Seguridad",
        parrafos: [
          "Las comunicaciones con nuestros servidores usan cifrado HTTPS. Aplicamos controles de acceso y límites por dispositivo e IP. Ningún sistema es 100% seguro, pero trabajamos para proteger tu información.",
        ],
      },
      {
        h2: "6. Menores de edad",
        parrafos: ["RenuevAI no está dirigida a menores de 13 años y no recopilamos conscientemente datos de menores."],
      },
      {
        h2: "7. Cambios a esta política",
        parrafos: ["Podemos actualizar esta política; publicaremos la nueva versión en esta misma página con su fecha de actualización."],
      },
      {
        h2: "8. Contacto",
        parrafos: ["Para dudas sobre privacidad o para solicitar la eliminación de tus datos, escribe a: CodaliaLabs@gmail.com."],
      },
    ],
  },

  en: {
    titulo: "RenuevAI Privacy Policy",
    fecha: "Last updated: July 20, 2026",
    intro: `RenuevAI ("the app", "we") transforms photos of real spaces using artificial intelligence. This policy explains what data we process, why, who we share it with, and what your rights are. By using RenuevAI you accept what is described here.`,
    secciones: [
      {
        h2: "1. Data we process",
        items: [
          "Photos you upload: images of your spaces (or reference photos) are sent to our servers and AI providers solely to generate your transformation. We do not use them for advertising or to train models.",
          "Anonymous device identifier: we generate a random identifier (not linked to your name) to apply daily usage limits and, if applicable, your subscription. No sign-up or account is required.",
          "IP address: processed temporarily as an anti-abuse security measure.",
          "Usage data: category used, generation date, and job status, to operate the app and control costs.",
          'Text you write to the "El Maestro" assistant: sent to our AI provider to answer you; not linked to your identity.',
          "Advertising identifier and ad data: in the free version we show ads via Google AdMob, which may use the device's advertising identifier (see section 3).",
          "Purchases: subscriptions are processed by Google Play; we do not receive or store your card data.",
        ],
        parrafos: ["We do not collect your name, email, phone number, contacts, precise location, or health or financial data."],
      },
      {
        h2: "2. What we use the data for",
        items: [
          "Generating and showing you your image and video transformations.",
          "Saving your history so you can view it again (you can delete it).",
          "Applying usage limits and, if you're Premium, unlocking your benefits.",
          "Preventing abuse and fraud of the service.",
          "Showing ads in the free version.",
        ],
      },
      {
        h2: "3. Providers we share data with",
        parrafos: ["To provide the service, some data is processed by third parties, each with its own privacy policy:"],
        items: [
          "Replicate — image and video generation (receives your photos to process them).",
          'Groq — the "El Maestro" text assistant.',
          "Supabase — storage of results and database.",
          "Render — server hosting.",
          "Google AdMob — advertising in the free version; may use the advertising identifier.",
          "Google Play — subscription processing.",
        ],
      },
      {
        h2: "4. Retention and deletion",
        parrafos: [
          'Your results are kept while you use the app. You can delete any transformation from the "Recent" section. If you want to delete all data associated with your device identifier, contact us (see contact) with your device ID, found under Settings → My account.',
        ],
      },
      {
        h2: "5. Security",
        parrafos: [
          "Communication with our servers uses HTTPS encryption. We apply access controls and per-device and per-IP limits. No system is 100% secure, but we work to protect your information.",
        ],
      },
      {
        h2: "6. Minors",
        parrafos: ["RenuevAI is not directed at children under 13 and we do not knowingly collect data from minors."],
      },
      {
        h2: "7. Changes to this policy",
        parrafos: ["We may update this policy; we will publish the new version on this same page with its update date."],
      },
      {
        h2: "8. Contact",
        parrafos: ["For privacy questions or to request deletion of your data, write to: CodaliaLabs@gmail.com."],
      },
    ],
  },

  pt: {
    titulo: "Política de Privacidade do RenuevAI",
    fecha: "Última atualização: 20 de julho de 2026",
    intro: `O RenuevAI ("o app", "nós") transforma fotos de espaços reais usando inteligência artificial. Esta política explica quais dados tratamos, para quê, com quem os compartilhamos e quais são os seus direitos. Ao usar o RenuevAI, você aceita o que está descrito aqui.`,
    secciones: [
      {
        h2: "1. Dados que tratamos",
        items: [
          "Fotos que você envia: as imagens dos seus espaços (ou de referência) são enviadas aos nossos servidores e provedores de IA apenas para gerar sua transformação. Não as usamos para publicidade nem para treinar modelos.",
          "Identificador de dispositivo anônimo: geramos um identificador aleatório (não vinculado ao seu nome) para aplicar os limites de uso diário e, se aplicável, sua assinatura. Não exigimos cadastro nem conta.",
          "Endereço IP: processado de forma temporária como medida de segurança contra abuso do serviço.",
          "Dados de uso: categoria usada, data da geração e status do trabalho, para operar o app e controlar custos.",
          'Texto que você escreve ao assistente "El Maestro": enviado ao nosso provedor de IA para responder; não é associado à sua identidade.',
          "Identificador de publicidade e dados de anúncios: na versão gratuita mostramos anúncios via Google AdMob, que pode usar o identificador de publicidade do dispositivo (ver seção 3).",
          "Compras: as assinaturas são processadas pelo Google Play; não recebemos nem armazenamos dados do seu cartão.",
        ],
        parrafos: ["Não coletamos nome, e-mail, telefone, contatos, localização precisa nem dados de saúde ou financeiros."],
      },
      {
        h2: "2. Para que usamos os dados",
        items: [
          "Gerar e mostrar suas transformações de imagem e vídeo.",
          "Salvar seu histórico para que você possa vê-lo novamente (você pode apagá-lo).",
          "Aplicar os limites de uso e, se você for Premium, desbloquear seus benefícios.",
          "Prevenir abuso e fraude do serviço.",
          "Mostrar anúncios na versão gratuita.",
        ],
      },
      {
        h2: "3. Provedores com quem compartilhamos dados",
        parrafos: ["Para prestar o serviço, alguns dados são processados por terceiros, cada um com sua própria política de privacidade:"],
        items: [
          "Replicate — geração de imagens e vídeo (recebe suas fotos para processá-las).",
          'Groq — assistente de texto "El Maestro".',
          "Supabase — armazenamento dos resultados e banco de dados.",
          "Render — hospedagem do servidor.",
          "Google AdMob — publicidade na versão gratuita; pode usar o identificador de publicidade.",
          "Google Play — processamento das assinaturas.",
        ],
      },
      {
        h2: "4. Retenção e eliminação",
        parrafos: [
          'Seus resultados são mantidos enquanto você usa o app. Você pode apagar qualquer transformação na seção "Recentes". Se quiser apagar todos os dados associados ao identificador do seu dispositivo, entre em contato (ver contato) informando seu ID de dispositivo, encontrado em Ajustes → Minha conta.',
        ],
      },
      {
        h2: "5. Segurança",
        parrafos: [
          "As comunicações com nossos servidores usam criptografia HTTPS. Aplicamos controles de acesso e limites por dispositivo e IP. Nenhum sistema é 100% seguro, mas trabalhamos para proteger suas informações.",
        ],
      },
      {
        h2: "6. Menores de idade",
        parrafos: ["O RenuevAI não é direcionado a menores de 13 anos e não coletamos conscientemente dados de menores."],
      },
      {
        h2: "7. Alterações a esta política",
        parrafos: ["Podemos atualizar esta política; publicaremos a nova versão nesta mesma página com sua data de atualização."],
      },
      {
        h2: "8. Contato",
        parrafos: ["Para dúvidas sobre privacidade ou para solicitar a exclusão dos seus dados, escreva para: CodaliaLabs@gmail.com."],
      },
    ],
  },

  it: {
    titulo: "Informativa sulla Privacy di RenuevAI",
    fecha: "Ultimo aggiornamento: 20 luglio 2026",
    intro: `RenuevAI ("l'app", "noi") è un'applicazione che trasforma fotografie di spazi reali usando l'intelligenza artificiale. Questa informativa spiega quali dati trattiamo, per quale scopo, con chi li condividiamo e quali sono i tuoi diritti. Usando RenuevAI accetti quanto qui descritto.`,
    secciones: [
      {
        h2: "1. Dati che trattiamo",
        items: [
          "Foto che carichi: le immagini dei tuoi spazi (o di riferimento) vengono inviate ai nostri server e ai nostri fornitori di IA unicamente per generare la tua trasformazione. Non le usiamo per pubblicità né per addestrare modelli.",
          "Identificativo del dispositivo anonimo: generiamo un identificativo casuale (non collegato al tuo nome) per applicare i limiti di utilizzo giornalieri e, se applicabile, il tuo abbonamento. Non è richiesta registrazione né account.",
          "Indirizzo IP: elaborato temporaneamente come misura di sicurezza contro l'abuso del servizio.",
          "Dati di utilizzo: categoria usata, data della generazione e stato del lavoro, per gestire l'app e controllare i costi.",
          'Testo che scrivi all\'assistente "El Maestro": inviato al nostro fornitore di IA per risponderti; non è associato alla tua identità.',
          "Identificativo pubblicitario e dati sugli annunci: nella versione gratuita mostriamo annunci tramite Google AdMob, che può usare l'identificativo pubblicitario del dispositivo (vedi sezione 3).",
          "Acquisti: gli abbonamenti sono elaborati da Google Play; non riceviamo né conserviamo i dati della tua carta.",
        ],
        parrafos: ["Non raccogliamo nome, email, telefono, contatti, posizione precisa né dati sanitari o finanziari."],
      },
      {
        h2: "2. A cosa servono i dati",
        items: [
          "Generare e mostrarti le tue trasformazioni di immagini e video.",
          "Salvare la tua cronologia per poterla rivedere (puoi eliminarla).",
          "Applicare i limiti di utilizzo e, se sei Premium, sbloccare i tuoi vantaggi.",
          "Prevenire abusi e frodi del servizio.",
          "Mostrare annunci nella versione gratuita.",
        ],
      },
      {
        h2: "3. Fornitori con cui condividiamo i dati",
        parrafos: ["Per fornire il servizio, alcuni dati vengono elaborati da terze parti, ciascuna con la propria informativa sulla privacy:"],
        items: [
          "Replicate — generazione di immagini e video (riceve le tue foto per elaborarle).",
          'Groq — assistente di testo "El Maestro".',
          "Supabase — archiviazione dei risultati e database.",
          "Render — hosting del server.",
          "Google AdMob — pubblicità nella versione gratuita; può usare l'identificativo pubblicitario.",
          "Google Play — elaborazione degli abbonamenti.",
        ],
      },
      {
        h2: "4. Conservazione ed eliminazione",
        parrafos: [
          'I tuoi risultati vengono conservati finché usi l\'app. Puoi eliminare qualsiasi trasformazione dalla sezione "Recenti". Se desideri eliminare tutti i dati associati al tuo identificativo del dispositivo, scrivici (vedi contatto) indicando il tuo ID dispositivo, che trovi in Impostazioni → Il mio account.',
        ],
      },
      {
        h2: "5. Sicurezza",
        parrafos: [
          "Le comunicazioni con i nostri server usano la crittografia HTTPS. Applichiamo controlli di accesso e limiti per dispositivo e IP. Nessun sistema è sicuro al 100%, ma lavoriamo per proteggere le tue informazioni.",
        ],
      },
      {
        h2: "6. Minori",
        parrafos: ["RenuevAI non è rivolta a minori di 13 anni e non raccogliamo consapevolmente dati di minori."],
      },
      {
        h2: "7. Modifiche a questa informativa",
        parrafos: ["Potremmo aggiornare questa informativa; pubblicheremo la nuova versione in questa stessa pagina con la sua data di aggiornamento."],
      },
      {
        h2: "8. Contatti",
        parrafos: ["Per domande sulla privacy o per richiedere l'eliminazione dei tuoi dati, scrivi a: CodaliaLabs@gmail.com."],
      },
    ],
  },
};
