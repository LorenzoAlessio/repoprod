(function () {
  'use strict';

  var examples = [
    {
      id: 'controllo-digitale',
      label: 'Gelosia possessiva',
      text: 'Amore ma perch\u00E9 hai messo like alla foto di Marco?? \uD83D\uDE24 Ti ho gi\u00E0 detto che non mi piace... se mi amassi davvero non lo faresti. Fammi vedere il telefono stasera, cos\u00EC mi fido. Non \u00E8 che non mi fido di te eh, \u00E8 che ci tengo a noi \u2764\uFE0F Lo faccio perch\u00E9 ti amo, lo capisci? Se non hai niente da nascondere non c\'\u00E8 problema no?',
      type: 'M\u2192F',
      technique: 'Controllo digitale'
    },
    {
      id: 'colpevolizzazione',
      label: 'Colpevolizzazione',
      text: 'Vabb\u00E8 vai pure con i tuoi amici, tanto io sto qui da sola a piangere come sempre. Non ti importa niente di come sto, se ti importasse non dovresti nemmeno chiedermelo. L\'altra sera stavo malissimo e tu dov\'eri?? Sempre a divertirti. A volte penso che senza di te starei meglio, almeno non soffrirei cos\u00EC \uD83D\uDE14',
      type: 'F\u2192M',
      technique: 'Colpevolizzazione'
    },
    {
      id: 'isolamento',
      label: 'Isolamento sociale',
      text: 'Ma davvero esci ancora con quella gente? \uD83D\uDE12 A me sembra che da quando li frequenti sei cambiata... non sei pi\u00F9 te stessa. Io ti conosco meglio di chiunque, fidati. Loro non ti vogliono bene come te ne voglio io. Perch\u00E9 non stiamo solo noi due stasera? Le persone vanno e vengono, noi siamo per sempre \u2728',
      type: 'Same-sex',
      technique: 'Isolamento'
    },
    {
      id: 'svalutazione',
      label: 'Svalutazione subdola',
      text: 'No vabbe ma lo dico per il tuo bene eh \uD83D\uDE02 Quella presentazione era un po\' imbarazzante, tutti lo pensavano ma nessuno te lo dice perch\u00E9 non gli importa. Io te lo dico perch\u00E9 sono l\'unica amica vera che hai. Dovresti ringraziarmi invece di offenderti, sei troppo sensibile. Se non ci fossi io a dirti la verit\u00E0 chi lo farebbe?',
      type: 'Amicizia',
      technique: 'Svalutazione'
    }
  ];

  window.Examples = {
    getAll: function () {
      return examples;
    }
  };
})();
