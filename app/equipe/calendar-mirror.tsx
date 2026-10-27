"use client";

export default function CalendarMirror({
  start,
  end,
}: {
  start: string;
  end: string;
}) {
  const params = new URLSearchParams({
    src: "ht12bilmontanha@gmail.com",
    ctz: "America/Sao_Paulo",
    hl: "pt_BR",
    mode: "AGENDA",
    dates: `${start.replaceAll("-", "")}/${end.replaceAll("-", "")}`,
    showTitle: "0",
    showPrint: "0",
    showCalendars: "0",
  });
  const url = `https://calendar.google.com/calendar/embed?${params}`;
  return (
    <section
      className="calendar-mirror"
      aria-label="Agenda do hotel para conferência"
    >
      <h4>Agenda do hotel</h4>
      <p>
        Antes de aprovar, confira na agenda se o quarto escolhido está livre
        no período de {start.split("-").reverse().join("/")} a{" "}
        {end.split("-").reverse().join("/")} (eventos de Q01, Q02, Q03 e Q04).
      </p>
      <iframe
        key={url}
        src={url}
        title="Google Agenda do Hotel de Trânsito"
        loading="lazy"
        className="calendar-mirror-frame"
      />
      <p className="fine">
        Para visualizar a agenda privada, entre no Google com uma conta que
        tenha acesso à agenda do hotel. Se o quadro não carregar, use o link
        abaixo.
      </p>
      <a href={url} target="_blank" rel="noreferrer">
        Abrir este período no Google Agenda
      </a>
      <p className="fine">
        A conferência da agenda é visual e de responsabilidade da equipe: o site
        não consulta o Google nem bloqueia a aprovação por causa dela.
      </p>
    </section>
  );
}
