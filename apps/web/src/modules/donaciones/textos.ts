import type { Idioma } from './contexto'

export interface Paso {
  titulo: string
  detalle: string
}

export interface Textos {
  aviso: {
    titulo: string
    descripcion: string
    parrafos: string[]
    donar: string
    ahoraNo: string
  }
  pagina: {
    seoTitulo: string
    seoDescripcion: string
    titulo: string
    intro: string
    compromisos: { titulo: string; texto: string }[]
    agradecimiento: string
  }
  selector: {
    etiqueta: string
    yape: string
    cci: string
    sugeridoYape: string
    sugeridoCci: string
  }
  panel: {
    yapeLeyenda: string
    yapeAlt: string
    yapeSinImagen: string
    cciSinNumero: string
    banco: string
    titular: string
    cci: string
    copiar: string
    copiado: string
  }
  pasos: {
    titulo: string
    yape: Paso[]
    cci: Paso[]
  }
}

export const TEXTOS: Record<Idioma, Textos> = {
  es: {
    aviso: {
      titulo: 'Donación',
      descripcion: 'Esta página se sostiene con aportes voluntarios.',
      parrafos: [
        'Mantener la página de El Camino Angosto tiene un costo económico cada mes. Lo que se done se usa únicamente para eso: que la página siga activa para quien la necesite.',
        'Donar es decisión tuya. Das lo que quieras, si quieres, y no pasa nada si no lo haces: no hace falta donar para escuchar, leer ni ver ningún contenido.',
        'Si esta página te ha acompañado y quieres ayudar a que siga ahí para otros, te lo agradecemos de corazón.',
      ],
      donar: 'Donar',
      ahoraNo: 'Ahora no',
    },
    pagina: {
      seoTitulo: 'Donación',
      seoDescripcion:
        'Cómo ayudar a mantener El Camino Angosto activo con un aporte voluntario. Por Yape desde Perú o por transferencia bancaria desde otros países.',
      titulo: 'Ayúdanos a mantener esto en pie',
      intro:
        'El Camino Angosto es gratuito y seguirá siéndolo. Si te ha servido y quieres que otros también lo encuentren mañana, puedes aportar. Cada donación se destina solo a mantener la página activa.',
      compromisos: [
        { titulo: 'Es voluntario', texto: 'Das lo que quieras, cuando quieras. No hay monto sugerido.' },
        { titulo: 'No es requisito', texto: 'Todo el contenido sigue abierto para ti, dones o no.' },
        { titulo: 'Tiene un solo fin', texto: 'Mantener la página activa. Nada más.' },
      ],
      agradecimiento: 'Gracias por pensarlo. Que Dios te bendiga, hagas o no tu aporte.',
    },
    selector: {
      etiqueta: 'Medio de donación',
      yape: 'Yape',
      cci: 'Transferencia',
      sugeridoYape: 'Te mostramos Yape porque parece que estás en Perú.',
      sugeridoCci: 'Te mostramos la transferencia bancaria porque parece que estás fuera de Perú.',
    },
    panel: {
      yapeLeyenda: 'Escanea con Yape y elige el monto',
      yapeAlt: 'Código QR de Yape para donar',
      yapeSinImagen: 'El código QR todavía no está disponible. Vuelve en unos días.',
      cciSinNumero: 'Los datos de la cuenta todavía no están disponibles. Vuelve en unos días.',
      banco: 'Banco',
      titular: 'Titular',
      cci: 'CCI',
      copiar: 'Copiar',
      copiado: 'Copiado',
    },
    pasos: {
      titulo: 'Paso a paso',
      yape: [
        { titulo: 'Abre Yape', detalle: 'En el celular donde lo tienes instalado.' },
        { titulo: 'Elige escanear QR', detalle: 'Es la opción para pagar leyendo un código con la cámara.' },
        {
          titulo: 'Escanea este código',
          detalle:
            'Apunta la cámara al QR de esta página. Si estás viendo la página en ese mismo celular, ábrela en una computadora u otro dispositivo para poder escanearlo.',
        },
        { titulo: 'Escribe el monto', detalle: 'El que tú decidas. No hay una cantidad correcta.' },
        { titulo: 'Confirma', detalle: 'Revisa los datos y confirma. Eso es todo. Gracias.' },
      ],
      cci: [
        { titulo: 'Entra a tu banco', detalle: 'En su app o en la banca por internet.' },
        {
          titulo: 'Elige transferir a otra cuenta',
          detalle:
            'Busca la transferencia a otros bancos. Desde fuera de Perú, pide una transferencia internacional a una cuenta en Perú.',
        },
        {
          titulo: 'Pega el CCI',
          detalle: 'Cópialo con el botón de esta página y comprueba que coincide dígito por dígito.',
        },
        {
          titulo: 'Comprueba el titular',
          detalle: 'Si tu banco muestra el nombre antes de confirmar, debe ser Rafael Enrique Roman Salazar.',
        },
        { titulo: 'Escribe el monto y confirma', detalle: 'El que tú decidas. Gracias por tu aporte.' },
      ],
    },
  },

  en: {
    aviso: {
      titulo: 'Donation',
      descripcion: 'This site is kept going by voluntary gifts.',
      parrafos: [
        'Maintaining the El Camino Angosto site comes with a financial cost every month. Whatever is given is used only for that: so the site stays up for anyone who needs it.',
        'Giving is entirely your choice. Give what you wish, if you wish, and nothing changes if you do not: you never need to donate to listen, read or watch anything here.',
        'If this site has kept you company and you would like to help it stay there for others, we are truly grateful.',
      ],
      donar: 'Donate',
      ahoraNo: 'Not now',
    },
    pagina: {
      seoTitulo: 'Donation',
      seoDescripcion:
        'How to help keep El Camino Angosto online with a voluntary gift. By Yape from Peru, or by bank transfer from other countries.',
      titulo: 'Help us keep this going',
      intro:
        'El Camino Angosto is free and will stay free. If it has helped you and you want others to find it tomorrow too, you can contribute. Every donation goes only toward keeping the site online.',
      compromisos: [
        { titulo: 'It is voluntary', texto: 'Give what you wish, whenever you wish. There is no suggested amount.' },
        { titulo: 'It is not required', texto: 'All the content stays open to you, whether you give or not.' },
        { titulo: 'It has one purpose', texto: 'Keeping the site online. Nothing else.' },
      ],
      agradecimiento: 'Thank you for considering it. God bless you, whether or not you give.',
    },
    selector: {
      etiqueta: 'Donation method',
      yape: 'Yape',
      cci: 'Bank transfer',
      sugeridoYape: 'We are showing Yape because you seem to be in Peru.',
      sugeridoCci: 'We are showing bank transfer because you seem to be outside Peru.',
    },
    panel: {
      yapeLeyenda: 'Scan with Yape and choose the amount',
      yapeAlt: 'Yape QR code for donating',
      yapeSinImagen: 'The QR code is not available yet. Please check back in a few days.',
      cciSinNumero: 'The account details are not available yet. Please check back in a few days.',
      banco: 'Bank',
      titular: 'Account holder',
      cci: 'CCI',
      copiar: 'Copy',
      copiado: 'Copied',
    },
    pasos: {
      titulo: 'Step by step',
      yape: [
        { titulo: 'Open Yape', detalle: 'On the phone where you have it installed.' },
        { titulo: 'Choose scan QR', detalle: 'It is the option to pay by reading a code with the camera.' },
        {
          titulo: 'Scan this code',
          detalle:
            'Point the camera at the QR on this page. If you are viewing this page on that same phone, open it on a computer or another device so you can scan it.',
        },
        { titulo: 'Enter the amount', detalle: 'Whatever you decide. There is no right amount.' },
        { titulo: 'Confirm', detalle: 'Check the details and confirm. That is all. Thank you.' },
      ],
      cci: [
        { titulo: 'Open your bank', detalle: 'In its app or online banking.' },
        {
          titulo: 'Choose transfer to another account',
          detalle:
            'Look for transfers to other banks. From outside Peru, request an international transfer to an account in Peru.',
        },
        {
          titulo: 'Paste the CCI',
          detalle: 'Copy it with the button on this page and check that it matches digit by digit.',
        },
        {
          titulo: 'Check the account holder',
          detalle: 'If your bank shows the name before you confirm, it should be Rafael Enrique Roman Salazar.',
        },
        { titulo: 'Enter the amount and confirm', detalle: 'Whatever you decide. Thank you for your gift.' },
      ],
    },
  },

  pt: {
    aviso: {
      titulo: 'Doação',
      descripcion: 'Este site se mantém com ofertas voluntárias.',
      parrafos: [
        'Manter o site El Camino Angosto tem um custo econômico todo mês. O que for doado é usado somente para isso: para que o site continue ativo para quem precisar.',
        'Doar é uma decisão sua. Você dá o que quiser, se quiser, e nada muda se não o fizer: não é preciso doar para ouvir, ler ou assistir a nenhum conteúdo.',
        'Se este site lhe fez companhia e você quer ajudar para que continue aqui para outras pessoas, agradecemos de coração.',
      ],
      donar: 'Doar',
      ahoraNo: 'Agora não',
    },
    pagina: {
      seoTitulo: 'Doação',
      seoDescripcion:
        'Como ajudar a manter o El Camino Angosto ativo com uma oferta voluntária. Por Yape no Peru ou por transferência bancária de outros países.',
      titulo: 'Ajude-nos a manter isto de pé',
      intro:
        'O El Camino Angosto é gratuito e continuará sendo. Se ele lhe fez bem e você quer que outras pessoas também o encontrem amanhã, pode contribuir. Cada doação vai somente para manter o site ativo.',
      compromisos: [
        { titulo: 'É voluntário', texto: 'Você dá o que quiser, quando quiser. Não há valor sugerido.' },
        { titulo: 'Não é requisito', texto: 'Todo o conteúdo continua aberto para você, doe ou não.' },
        { titulo: 'Tem um único fim', texto: 'Manter o site ativo. Nada mais.' },
      ],
      agradecimiento: 'Obrigado por considerar. Deus o abençoe, doe ou não.',
    },
    selector: {
      etiqueta: 'Forma de doação',
      yape: 'Yape',
      cci: 'Transferência',
      sugeridoYape: 'Mostramos o Yape porque parece que você está no Peru.',
      sugeridoCci: 'Mostramos a transferência bancária porque parece que você está fora do Peru.',
    },
    panel: {
      yapeLeyenda: 'Escaneie com o Yape e escolha o valor',
      yapeAlt: 'Código QR do Yape para doar',
      yapeSinImagen: 'O código QR ainda não está disponível. Volte em alguns dias.',
      cciSinNumero: 'Os dados da conta ainda não estão disponíveis. Volte em alguns dias.',
      banco: 'Banco',
      titular: 'Titular',
      cci: 'CCI',
      copiar: 'Copiar',
      copiado: 'Copiado',
    },
    pasos: {
      titulo: 'Passo a passo',
      yape: [
        { titulo: 'Abra o Yape', detalle: 'No celular onde ele está instalado.' },
        { titulo: 'Escolha escanear QR', detalle: 'É a opção para pagar lendo um código com a câmera.' },
        {
          titulo: 'Escaneie este código',
          detalle:
            'Aponte a câmera para o QR desta página. Se você está vendo a página nesse mesmo celular, abra-a em um computador ou outro dispositivo para poder escaneá-lo.',
        },
        { titulo: 'Digite o valor', detalle: 'O que você decidir. Não existe um valor certo.' },
        { titulo: 'Confirme', detalle: 'Confira os dados e confirme. É só isso. Obrigado.' },
      ],
      cci: [
        { titulo: 'Entre no seu banco', detalle: 'No aplicativo ou no internet banking.' },
        {
          titulo: 'Escolha transferir para outra conta',
          detalle:
            'Procure a transferência para outros bancos. De fora do Peru, peça uma transferência internacional para uma conta no Peru.',
        },
        {
          titulo: 'Cole o CCI',
          detalle: 'Copie-o com o botão desta página e confira se coincide dígito por dígito.',
        },
        {
          titulo: 'Confira o titular',
          detalle: 'Se o seu banco mostrar o nome antes de confirmar, deve ser Rafael Enrique Roman Salazar.',
        },
        { titulo: 'Digite o valor e confirme', detalle: 'O que você decidir. Obrigado pela sua oferta.' },
      ],
    },
  },
}
