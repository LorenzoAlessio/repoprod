(function () {
  'use strict';

  var cards = [
    {
      id: 'gaslighting',
      title: 'Gaslighting',
      emoji: '\uD83C\uDF2B\uFE0F',
      shortDesc: 'Ti fanno dubitare della tua percezione della realt\u00E0.',
      longDesc: 'Il gaslighting \u00E8 quando qualcuno nega cose che sono successe, minimizza le tue emozioni o ti fa sentire di stare esagerando. Con il tempo inizi a non fidarti pi\u00F9 di te. \u00C8 una delle tecniche pi\u00F9 subdole perch\u00E9 ti convince che il problema sei tu, non la persona che ti sta manipolando.',
      example: '\u00ABMa quando mai ho detto questo? Te lo stai inventando, sei sempre la solita esagerata.\u00BB',
      redFlags: [
        'Negano cose che ricordi chiaramente',
        'Ti dicono che sei troppo sensibile',
        'Cambiano versione dei fatti',
        'Ti senti confusa/o dopo ogni discussione'
      ]
    },
    {
      id: 'love-bombing',
      title: 'Love Bombing',
      emoji: '\uD83D\uDCA3',
      shortDesc: 'Ti sommergono di attenzioni eccessive per conquistare il controllo.',
      longDesc: 'Il love bombing \u00E8 un\'inondazione di messaggi, regali, complimenti e dichiarazioni d\'amore esagerate, soprattutto all\'inizio della relazione. Sembra romantico ma serve a creare una dipendenza emotiva veloce. Quando ti sei legata/o, le attenzioni spariscono e inizia la manipolazione vera.',
      example: '\u00ABSei la persona pi\u00F9 speciale del mondo, non ho mai provato niente del genere. Voglio stare con te ogni secondo.\u00BB',
      redFlags: [
        'Troppo troppo presto: ti amo dopo pochi giorni',
        'Ti scrive decine di messaggi al giorno',
        'Si offende se non rispondi subito',
        'Vuole esclusivit\u00E0 immediata'
      ]
    },
    {
      id: 'colpevolizzazione',
      title: 'Colpevolizzazione',
      emoji: '\uD83C\uDFAD',
      shortDesc: 'Ribaltano la colpa su di te per ogni problema della relazione.',
      longDesc: 'La colpevolizzazione \u00E8 quando la persona ti fa sentire responsabile delle sue emozioni negative, delle sue reazioni e persino del suo comportamento sbagliato. Se si arrabbia \u00E8 colpa tua, se sta male \u00E8 perch\u00E9 tu hai fatto qualcosa. Ti ritrovi sempre a scusarti anche quando non hai fatto nulla.',
      example: '\u00ABSe non ti avessi trovato quel messaggio non mi sarei arrabbiata cos\u00EC. Mi costringi a reagire.\u00BB',
      redFlags: [
        'Ti scusi sempre anche senza motivo',
        'Ti senti in colpa per i loro comportamenti',
        'Ogni discussione finisce con te che chiedi scusa',
        'Usano il loro malessere come arma'
      ]
    },
    {
      id: 'isolamento',
      title: 'Isolamento',
      emoji: '\uD83D\uDD12',
      shortDesc: 'Ti allontanano dalle persone che ti vogliono bene.',
      longDesc: 'L\'isolamento avviene gradualmente: prima critiche sottili verso i tuoi amici o la tua famiglia, poi scenate di gelosia, infine ti ritrovi senza rete di supporto. La persona manipolatrice vuole essere l\'unico punto di riferimento cos\u00EC diventi pi\u00F9 dipendente e pi\u00F9 facile da controllare.',
      example: '\u00ABQuei tuoi amici non ti capiscono come ti capisco io. Fidati, ti stanno usando.\u00BB',
      redFlags: [
        'Critiche costanti verso amici e famiglia',
        'Scenate prima o dopo le uscite',
        'Ti senti in colpa quando vedi altre persone',
        'Il tuo mondo sociale si \u00E8 ristretto'
      ]
    },
    {
      id: 'controllo-digitale',
      title: 'Controllo digitale',
      emoji: '\uD83D\uDCF1',
      shortDesc: 'Monitorano la tua vita online mascherandola da \u201Cpremura\u201D.',
      longDesc: 'Il controllo digitale \u00E8 quando la persona vuole accesso al tuo telefono, controlla i tuoi like e follower, vuole sapere con chi chatti, pretende la tua password o si arrabbia se non rispondi subito. Spesso viene camuffato da gesto d\'amore ma \u00E8 una forma di sorveglianza.',
      example: '\u00ABSe non hai niente da nascondere dammi la password. Lo faccio perch\u00E9 ti amo.\u00BB',
      redFlags: [
        'Vogliono le tue password',
        'Controllano ultimo accesso e spunte blu',
        'Ti chiedono screenshot delle chat',
        'Si arrabbiano per like o follower'
      ]
    },
    {
      id: 'svalutazione',
      title: 'Svalutazione',
      emoji: '\uD83D\uDCC9',
      shortDesc: 'Ti sminuiscono sistematicamente fingendo di aiutarti.',
      longDesc: 'La svalutazione \u00E8 fatta di commenti travestiti da consigli, battute che feriscono mascherate da ironia, paragoni con altre persone. L\'obiettivo \u00E8 abbassare la tua autostima fino a farti credere di non valere, cos\u00EC non avrai la forza di andartene e penserai di non meritare di meglio.',
      example: '\u00ABLo dico per il tuo bene: nessun altro te lo direbbe perch\u00E9 non gli importa di te come a me.\u00BB',
      redFlags: [
        'Critiche mascherate da consigli',
        'Battute che ti feriscono seguite da "scherzo"',
        'Ti paragonano ad altre persone',
        'La tua autostima \u00E8 calata da quando li frequenti'
      ]
    },
    {
      id: 'idealizzazione-devalutazione',
      title: 'Idealizzazione e devalutazione',
      emoji: '\uD83C\uDFA2',
      shortDesc: 'Alternano fasi di adorazione totale a freddezza improvvisa.',
      longDesc: 'Questo ciclo ti tiene agganciata/o: un giorno sei perfetta/o, il giorno dopo non vali niente. L\'alternanza crea una dipendenza simile a quella da gioco d\'azzardo \u2014 resti nella relazione sperando che torni la fase bella. Ma le fasi belle servono solo a tenerti l\u00EC per le fasi brutte.',
      example: '\u00ABSei la cosa pi\u00F9 bella della mia vita\u00BB il luned\u00EC, \u00ABnon so nemmeno perch\u00E9 sto con te\u00BB il mercoled\u00EC.',
      redFlags: [
        'Cambiamenti d\'umore improvvisi verso di te',
        'Ti senti sempre in bilico',
        'Cerchi disperatamente di tornare alla fase bella',
        'Non sai mai cosa aspettarti'
      ]
    }
  ];

  window.Education = {
    getAll: function () {
      return cards;
    }
  };
})();
