import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import CampaignRoundedIcon from "@mui/icons-material/CampaignRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import EmailRoundedIcon from "@mui/icons-material/EmailRounded";
import FavoriteBorderRoundedIcon from "@mui/icons-material/FavoriteBorderRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import LocalLibraryRoundedIcon from "@mui/icons-material/LocalLibraryRounded";
import LocationOnRoundedIcon from "@mui/icons-material/LocationOnRounded";
import LoginRoundedIcon from "@mui/icons-material/LoginRounded";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import PhotoLibraryRoundedIcon from "@mui/icons-material/PhotoLibraryRounded";
import SchoolRoundedIcon from "@mui/icons-material/SchoolRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import SecurityRoundedIcon from "@mui/icons-material/SecurityRounded";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import VolunteerActivismRoundedIcon from "@mui/icons-material/VolunteerActivismRounded";
import WorkspacesRoundedIcon from "@mui/icons-material/WorkspacesRounded";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useInstitutionalPage } from "../api/hooks";
import { api } from "../api/client";
import { BrazilMissionMap } from "../components/institutional/BrazilMissionMap";
import "./InstitutionalPage.css";

type Scope = "SMIF" | "CIPAVD";

type Locality = {
  id: string;
  code: string;
  name: string;
  uf?: string | null;
};

type InstitutionalAction = {
  id: string;
  title: string;
  summary?: string | null;
  scope: Scope;
  startDate: string;
  endDate: string;
  year: number;
  status: "PROGRAMADA" | "EM_ANDAMENTO" | "REALIZADA";
  locality: Locality;
};

type InstitutionalNews = {
  id: string;
  title: string;
  summary?: string | null;
  audience: "INTERNAL" | "EXTERNAL";
  publishedAt: string;
  sourceUrl: string;
  coverImageUrl?: string | null;
};

type InstitutionalMember = {
  id: string;
  name: string;
  function?: string | null;
  seniority?: number | null;
  photoUrl?: string | null;
};

type InstitutionalPhoto = {
  id: string;
  title: string;
  imageUrl: string;
  mimeType?: string | null;
};

type InstitutionalData = {
  generatedAt: string;
  lastUpdatedAt: string;
  members: InstitutionalMember[];
  actions: InstitutionalAction[];
  agenda: Array<{
    id: string;
    title: string;
    scope: Scope;
    startDate: string;
    endDate: string;
    status: InstitutionalAction["status"];
    location: string;
    locality: Locality;
  }>;
  news: InstitutionalNews[];
  supportChannels: Array<{
    servedOm: { id: string; code: string; name: string; uf?: string | null };
    responsibleCpca: { id: string; code: string; name: string; uf?: string | null };
    coverageType: "OWN_CPCA" | "MANAGED_BY_OTHER";
    email?: string | null;
    intraerUrl?: string | null;
  }>;
  materials: Array<{
    id: string;
    title: string;
    scope: Scope;
    fileName: string;
    mimeType?: string | null;
    fileSize?: number | null;
    publishedAt: string;
    downloadUrl: string;
  }>;
  library: {
    totalPhotos: number;
    groups: Array<{
      id: string;
      title: string;
      scope: Scope;
      locality?: Locality | null;
      photos: InstitutionalPhoto[];
    }>;
  };
  totals: {
    members: number;
    actions: number;
    states: number;
    supportChannels: number;
    libraryPhotos: number;
  };
};

const NAV_ITEMS = [
  ["Sobre", "sobre"],
  ["Membros", "membros"],
  ["Áreas de atuação", "areas-atuacao"],
  ["Ações", "acoes"],
  ["Notícias", "noticias"],
  ["Agenda", "agenda"],
  ["Apoio", "apoio"],
  ["Biblioteca", "biblioteca"],
] as const;

const ACTION_AREAS = [
  {
    icon: SchoolRoundedIcon,
    title: "Educação e conscientização",
    text: "Realização de palestras, campanhas, oficinas e rodas de conversa destinadas à sensibilização do efetivo sobre assédio moral, assédio sexual, violência doméstica, respeito mútuo e convivência saudável no ambiente de trabalho.",
  },
  {
    icon: VolunteerActivismRoundedIcon,
    title: "Orientação e acolhimento",
    text: "Promoção de ações de orientação e escuta inicial às pessoas que necessitem de apoio, em articulação com as CPCAs das Organizações Militares e com os canais institucionais competentes.",
  },
  {
    icon: SecurityRoundedIcon,
    title: "Prevenção ao assédio",
    text: "Desenvolvimento de iniciativas voltadas à prevenção do assédio moral e do assédio sexual, difundindo boas práticas de relacionamento interpessoal, ética, respeito e valorização da dignidade da pessoa humana.",
  },
  {
    icon: FavoriteBorderRoundedIcon,
    title: "Prevenção à violência doméstica",
    text: "Realização de ações educativas para conscientizar sobre as diferentes formas de violência doméstica e familiar, seus impactos e a importância da rede de proteção e dos canais de apoio disponíveis.",
  },
  {
    icon: WorkspacesRoundedIcon,
    title: "Capacitação institucional",
    text: "Apoio às Organizações Militares por meio da capacitação de gestores, militares e servidores civis, fortalecendo a cultura organizacional de prevenção, acolhimento e respeito às pessoas.",
  },
];

const STATUS_LABEL: Record<InstitutionalAction["status"], string> = {
  PROGRAMADA: "Programada",
  EM_ANDAMENTO: "Em andamento",
  REALIZADA: "Realizada",
};

function toApiUrl(value: string | null | undefined) {
  const path = String(value ?? "").trim();
  if (!path) return "";
  if (/^(https?:|data:)/i.test(path)) return path;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const baseUrl = String(api.defaults.baseURL ?? "/api").replace(/\/$/, "");
  if (/^https?:\/\//i.test(baseUrl)) return `${baseUrl}${normalizedPath}`;
  if (normalizedPath.startsWith("/api/")) return normalizedPath;
  return `${baseUrl || "/api"}${normalizedPath}`;
}

function formatDate(value: string, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...options,
  }).format(new Date(value));
}

function formatDateRange(start: string, end: string) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const sameDay = startDate.toDateString() === endDate.toDateString();
  if (sameDay) return formatDate(start);
  return `${formatDate(start)} — ${formatDate(end)}`;
}

function initials(name: string) {
  return String(name || "CIPAVD")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function fileSize(value?: number | null) {
  if (!value) return "Documento";
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function SectionHeading({
  eyebrow,
  title,
  text,
}: {
  eyebrow: string;
  title: string;
  text?: string;
}) {
  return (
    <div className="institutional-section-heading">
      <span className="institutional-eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      {text ? <p>{text}</p> : null}
    </div>
  );
}

function EmptyInstitutionalState({ children }: { children: string }) {
  return (
    <div className="institutional-empty">
      <ShieldRoundedIcon />
      <p>{children}</p>
    </div>
  );
}

function InstitutionalNewsCover({ news }: { news: InstitutionalNews }) {
  const [failedImageUrl, setFailedImageUrl] = useState("");
  const imageUrl = toApiUrl(news.coverImageUrl);

  if (!imageUrl || failedImageUrl === imageUrl) return <CampaignRoundedIcon />;

  return (
    <img
      src={imageUrl}
      alt={`Capa da notícia: ${news.title}`}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailedImageUrl(imageUrl)}
    />
  );
}

function InstitutionalMemberAvatar({ member }: { member: InstitutionalMember }) {
  const [failedImageUrl, setFailedImageUrl] = useState("");
  const imageUrl = toApiUrl(member.photoUrl);

  return (
    <span className="institutional-member-card__avatar">
      {imageUrl && failedImageUrl !== imageUrl ? (
        <img
          src={imageUrl}
          alt={member.name}
          loading="lazy"
          onError={() => setFailedImageUrl(imageUrl)}
        />
      ) : (
        initials(member.name)
      )}
    </span>
  );
}

export function InstitutionalPage() {
  const institutionalQuery = useInstitutionalPage();
  const data = institutionalQuery.data as InstitutionalData | undefined;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedScope, setSelectedScope] = useState<"ALL" | Scope>("ALL");
  const [selectedUf, setSelectedUf] = useState("");
  const [supportSearch, setSupportSearch] = useState("");
  const [libraryScope, setLibraryScope] = useState<"ALL" | Scope>("ALL");
  const [lightbox, setLightbox] = useState<InstitutionalPhoto | null>(null);

  useEffect(() => {
    const previousTitle = document.title;
    const existingDescription = document.querySelector<HTMLMetaElement>(
      'meta[name="description"]',
    );
    const description = existingDescription ?? document.createElement("meta");
    const previousDescription = existingDescription?.content;

    document.title = "CIPAVD — Informação, prevenção e acolhimento";
    description.name = "description";
    description.content =
      "Página institucional da CIPAVD com ações, agenda, notícias, canais de apoio e biblioteca.";

    if (!existingDescription) document.head.appendChild(description);

    return () => {
      document.title = previousTitle;
      if (existingDescription) {
        existingDescription.content = previousDescription ?? "";
      } else {
        description.remove();
      }
    };
  }, []);

  const stateCounts = useMemo(() => {
    const result: Record<string, number> = {};
    for (const action of data?.actions ?? []) {
      const uf = String(action.locality?.uf ?? "").toUpperCase();
      if (uf) result[uf] = (result[uf] ?? 0) + 1;
    }
    return result;
  }, [data?.actions]);

  const filteredActions = useMemo(
    () =>
      (data?.actions ?? []).filter(
        (action) =>
          (selectedScope === "ALL" || action.scope === selectedScope) &&
          (!selectedUf || action.locality?.uf === selectedUf),
      ),
    [data?.actions, selectedScope, selectedUf],
  );

  const supportChannels = useMemo(() => {
    const query = supportSearch.trim().toLocaleLowerCase("pt-BR");
    if (!query) return data?.supportChannels ?? [];
    return (data?.supportChannels ?? []).filter((channel) =>
      [
        channel.servedOm.code,
        channel.servedOm.name,
        channel.servedOm.uf,
        channel.responsibleCpca.code,
        channel.responsibleCpca.name,
      ]
        .join(" ")
        .toLocaleLowerCase("pt-BR")
        .includes(query),
    );
  }, [data?.supportChannels, supportSearch]);

  const libraryGroups = useMemo(
    () =>
      (data?.library.groups ?? []).filter(
        (group) => libraryScope === "ALL" || group.scope === libraryScope,
      ),
    [data?.library.groups, libraryScope],
  );

  const handleAnchorClick = () => setMobileMenuOpen(false);

  if (institutionalQuery.isLoading) {
    return (
      <main className="institutional-status-page" aria-busy="true">
        <img src="/brand/cipavd-7.png" alt="CIPAVD" />
        <div className="institutional-loader" />
        <p>Carregando informações institucionais…</p>
      </main>
    );
  }

  if (institutionalQuery.isError || !data) {
    return (
      <main className="institutional-status-page">
        <img src="/brand/cipavd-7.png" alt="CIPAVD" />
        <h1>Não foi possível carregar a página institucional</h1>
        <p>Verifique sua conexão e tente novamente.</p>
        <button type="button" onClick={() => institutionalQuery.refetch()}>
          Tentar novamente
        </button>
        <Link to="/login">Acessar o sistema</Link>
      </main>
    );
  }

  return (
    <div className="institutional-page">
      <a className="institutional-skip-link" href="#conteudo-institucional">
        Ir para o conteúdo
      </a>

      <header className="institutional-header">
        <div className="institutional-container institutional-header__inner">
          <a className="institutional-brand" href="#inicio" aria-label="CIPAVD — início">
            <img src="/brand/cipavd-7.png" alt="" />
            <span>
              <strong>CIPAVD</strong>
              <small>COMGEP • Força Aérea Brasileira</small>
            </span>
          </a>

          <button
            type="button"
            className="institutional-menu-button"
            aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((current) => !current)}
          >
            {mobileMenuOpen ? <CloseRoundedIcon /> : <MenuRoundedIcon />}
          </button>

          <nav
            className={`institutional-nav${mobileMenuOpen ? " is-open" : ""}`}
            aria-label="Navegação institucional"
          >
            {NAV_ITEMS.map(([label, anchor]) => (
              <a key={anchor} href={`#${anchor}`} onClick={handleAnchorClick}>
                {label}
              </a>
            ))}
            <Link className="institutional-login-link" to="/login" onClick={handleAnchorClick}>
              <LoginRoundedIcon />
              Acessar sistema
            </Link>
          </nav>
        </div>
      </header>

      <main id="conteudo-institucional">
        <section id="inicio" className="institutional-hero">
          <div className="institutional-hero__orb institutional-hero__orb--one" />
          <div className="institutional-hero__orb institutional-hero__orb--two" />
          <div className="institutional-container institutional-hero__grid">
            <div className="institutional-hero__content">
              <h1>
                Informação, prevenção <span>e acolhimento</span>
              </h1>
              <p>
                A Comissão Itinerante de Prevenção ao Assédio e à Violência Doméstica
                desenvolve ações educativas e preventivas destinadas ao efetivo da Força
                Aérea Brasileira.
              </p>
              <div className="institutional-hero__actions">
                <a className="institutional-button institutional-button--primary" href="#sobre">
                  Conheça a CIPAVD <ArrowForwardRoundedIcon />
                </a>
                <a className="institutional-button institutional-button--ghost" href="#apoio">
                  Encontrar orientação
                </a>
              </div>
            </div>

            <div className="institutional-hero__visual" aria-hidden="true">
              <div className="institutional-hero__seal">
                <img src="/brand/cipavd-7.png" alt="" />
              </div>
            </div>
          </div>

          <div className="institutional-container institutional-hero__stats" aria-label="Indicadores da página">
            <div><strong>{data.totals.actions}</strong><span>Ações cadastradas</span></div>
            <div><strong>{data.totals.states}</strong><span>Estados alcançados</span></div>
            <div><strong>{data.totals.members}</strong><span>Membros da comissão</span></div>
            <div><strong>{data.totals.supportChannels}</strong><span>OMs com canal disponível</span></div>
          </div>
        </section>

        <section id="sobre" className="institutional-section institutional-about">
          <div className="institutional-container">
            <div className="institutional-about__intro">
              <SectionHeading
                eyebrow="Quem somos"
                title="O que é a CIPAVD"
                text="Uma atuação itinerante, educativa e orientadora para fortalecer relações profissionais seguras e respeitosas."
              />
              <div className="institutional-about__copy">
                <p>
                  A Comissão Itinerante de Prevenção ao Assédio e à Violência Doméstica
                  (CIPAVD), vinculada ao Comando-Geral do Pessoal (COMGEP), promove ações
                  de conscientização, orientação e prevenção voltadas à construção de um
                  ambiente organizacional cada vez mais seguro, respeitoso e acolhedor.
                </p>
                <p>
                  Com caráter itinerante, a Comissão atua junto às Organizações Militares
                  da Força Aérea Brasileira, fortalecendo a cultura do respeito, da
                  dignidade e da valorização das relações interpessoais.
                </p>
              </div>
            </div>

            <div className="institutional-materials">
              <div>
                <span className="institutional-eyebrow">Materiais de apoio</span>
                <h3>Informação para orientar e prevenir</h3>
                <p>Cartilhas e normativos oficiais disponibilizados no acervo do sistema.</p>
              </div>
              <div className="institutional-materials__list">
                {data.materials.length ? (
                  data.materials.map((material) => (
                    <a key={material.id} href={toApiUrl(material.downloadUrl)}>
                      <LocalLibraryRoundedIcon />
                      <span><strong>{material.title}</strong><small>{material.scope} • {fileSize(material.fileSize)}</small></span>
                      <DownloadRoundedIcon />
                    </a>
                  ))
                ) : (
                  <p className="institutional-muted">Os materiais serão exibidos assim que forem publicados na Biblioteca.</p>
                )}
              </div>
            </div>
          </div>
        </section>

        <section id="membros" className="institutional-section institutional-members-section">
          <div className="institutional-container">
            <SectionHeading
              eyebrow="Nossa equipe"
              title="Membros da CIPAVD"
            />
            {data.members.length ? (
              <div className="institutional-org-chart">
                <article className="institutional-member-card institutional-member-card--lead">
                  <InstitutionalMemberAvatar member={data.members[0]} />
                  <div>
                    <small>Coordenação</small>
                    <h3>{data.members[0].name}</h3>
                    <p>{data.members[0].function || "Comissão CIPAVD"}</p>
                  </div>
                </article>
                {data.members.length > 1 ? <div className="institutional-org-chart__line" /> : null}
                <div className="institutional-org-chart__members">
                  {data.members.slice(1).map((member) => (
                    <article key={member.id} className="institutional-member-card">
                      <InstitutionalMemberAvatar member={member} />
                      <div>
                        <h3>{member.name}</h3>
                        <p>{member.function || "Membro da Comissão"}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyInstitutionalState>A composição da comissão será exibida após a atualização do organograma.</EmptyInstitutionalState>
            )}
          </div>
        </section>

        <section id="areas-atuacao" className="institutional-section institutional-areas-section">
          <div className="institutional-container">
            <SectionHeading
              eyebrow="Como atuamos"
              title="Principais áreas de atuação"
              text="A CIPAVD desenvolve ações voltadas à promoção de um ambiente institucional seguro, respeitoso e livre de qualquer forma de violência. Sua atuação possui caráter preventivo, educativo e orientador, abrangendo as seguintes áreas:"
            />
            <div className="institutional-area-grid">
              {ACTION_AREAS.map((area) => {
                const Icon = area.icon;
                return (
                  <article key={area.title} className="institutional-area-card">
                    <span><Icon /></span>
                    <h3>{area.title}</h3>
                    <p>{area.text}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="acoes" className="institutional-section institutional-actions-section">
          <div className="institutional-container">
            <SectionHeading
              eyebrow="Presença nacional"
              title="Ações da CIPAVD e do SMIF"
              text="Missões e atividades registradas no sistema, organizadas por localidade e período."
            />
            <div className="institutional-actions-layout">
              <div className="institutional-map-card">
                <div className="institutional-map-card__head">
                  <div><strong>Atuação pelo Brasil</strong><span>Selecione um estado para filtrar</span></div>
                  {selectedUf ? <button type="button" onClick={() => setSelectedUf("")}>Limpar {selectedUf}</button> : null}
                </div>
                <BrazilMissionMap
                  counts={stateCounts}
                  selectedUf={selectedUf}
                  onSelect={(uf) => setSelectedUf((current) => current === uf ? "" : uf)}
                />
                <div className="institutional-map-legend"><span /> Menos ações <i /> Mais ações</div>
              </div>

              <div className="institutional-actions-feed">
                <div className="institutional-filter-row" aria-label="Filtrar ações por frente">
                  {(["ALL", "CIPAVD", "SMIF"] as const).map((scope) => (
                    <button
                      type="button"
                      key={scope}
                      className={selectedScope === scope ? "is-active" : ""}
                      onClick={() => setSelectedScope(scope)}
                    >
                      {scope === "ALL" ? "Todas" : scope}
                    </button>
                  ))}
                </div>
                <p className="institutional-results-count">
                  {filteredActions.length} ação(ões){selectedUf ? ` em ${selectedUf}` : ""}
                </p>
                <div className="institutional-actions-list">
                  {filteredActions.length ? filteredActions.slice(0, 10).map((action) => (
                    <article key={action.id} className="institutional-action-card">
                      <div className="institutional-action-card__date">
                        <strong>{new Date(action.startDate).getUTCFullYear()}</strong>
                        <span>{formatDate(action.startDate, { day: "2-digit", month: "short", year: undefined })}</span>
                      </div>
                      <div className="institutional-action-card__body">
                        <div className="institutional-chip-row">
                          <span className={`institutional-scope-chip is-${action.scope.toLowerCase()}`}>{action.scope}</span>
                          <span className={`institutional-status-chip is-${action.status.toLowerCase()}`}>{STATUS_LABEL[action.status]}</span>
                        </div>
                        <h3>{action.title}</h3>
                        <p className="institutional-action-card__location"><LocationOnRoundedIcon /> {action.locality.code} • {action.locality.name}{action.locality.uf ? `/${action.locality.uf}` : ""}</p>
                        {action.summary ? <p>{action.summary}</p> : null}
                      </div>
                    </article>
                  )) : <EmptyInstitutionalState>Nenhuma ação encontrada para o filtro selecionado.</EmptyInstitutionalState>}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="noticias" className="institutional-section institutional-news-section">
          <div className="institutional-container">
            <SectionHeading
              eyebrow="Impacto positivo"
              title="Notícias e histórias que inspiram"
              text="Notícias destinadas aos públicos interno e externo, publicadas em Impacto Positivo."
            />
            {data.news.length ? (
              <div className="institutional-news-grid">
                {data.news.map((news) => (
                  <article key={news.id} className="institutional-news-card">
                    <div className="institutional-news-card__media">
                      <InstitutionalNewsCover news={news} />
                      <span>{news.audience === "INTERNAL" ? "Público interno" : "Público externo"}</span>
                    </div>
                    <div className="institutional-news-card__body">
                      <small>{formatDate(news.publishedAt)}</small>
                      <h3>{news.title}</h3>
                      {news.summary ? <p>{news.summary}</p> : null}
                      <a href={news.sourceUrl} target="_blank" rel="noreferrer">
                        Ler notícia <OpenInNewRoundedIcon />
                      </a>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyInstitutionalState>Novas histórias de impacto positivo serão publicadas aqui.</EmptyInstitutionalState>
            )}
          </div>
        </section>

        <section id="agenda" className="institutional-section institutional-agenda-section">
          <div className="institutional-container institutional-agenda-layout">
            <SectionHeading
              eyebrow="Próximos compromissos"
              title="Agenda da CIPAVD"
              text="Programação construída a partir das missões CIPAVD e SMIF cadastradas no sistema."
            />
            {data.agenda.length ? (
              <div className="institutional-agenda-list">
                {data.agenda.map((item) => (
                  <article key={item.id} className="institutional-agenda-item">
                    <div className="institutional-agenda-item__calendar">
                      <span>{formatDate(item.startDate, { month: "short", day: undefined, year: undefined })}</span>
                      <strong>{formatDate(item.startDate, { day: "2-digit", month: undefined, year: undefined })}</strong>
                    </div>
                    <div className="institutional-agenda-item__content">
                      <div><span className={`institutional-scope-chip is-${item.scope.toLowerCase()}`}>{item.scope}</span><span className={`institutional-status-chip is-${item.status.toLowerCase()}`}>{STATUS_LABEL[item.status]}</span></div>
                      <h3>{item.title}</h3>
                      <small><LocationOnRoundedIcon /> {item.location} • {formatDateRange(item.startDate, item.endDate)}</small>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyInstitutionalState>Não há missões futuras cadastradas neste momento.</EmptyInstitutionalState>
            )}
          </div>
        </section>

        <section id="apoio" className="institutional-section institutional-support-section">
          <div className="institutional-container">
            <div className="institutional-support-hero">
              <div>
                <span className="institutional-eyebrow">Orientação e apoio</span>
                <h2>Encontre a CPCA que atende sua Organização Militar</h2>
                <p>
                  As Comissões Permanentes de Combate ao Assédio estão preparadas para
                  realizar o acolhimento inicial, a escuta qualificada e a orientação
                  necessária, com respeito, sigilo e encaminhamento adequado.
                </p>
              </div>
              <div className="institutional-support-hero__icon"><GroupsRoundedIcon /></div>
            </div>

            <label className="institutional-support-search">
              <SearchRoundedIcon />
              <span className="institutional-sr-only">Buscar Organização Militar</span>
              <input
                value={supportSearch}
                onChange={(event) => setSupportSearch(event.target.value)}
                placeholder="Digite a sigla, o nome da OM, a UF ou a CPCA responsável"
              />
              {supportSearch ? <button type="button" aria-label="Limpar busca" onClick={() => setSupportSearch("")}><CloseRoundedIcon /></button> : null}
            </label>

            <p className="institutional-results-count">{supportChannels.length} resultado(s)</p>
            {supportChannels.length ? (
              <div className="institutional-support-grid">
                {supportChannels.slice(0, supportSearch ? 60 : 18).map((channel) => {
                  const inherited = channel.coverageType === "MANAGED_BY_OTHER";
                  return (
                    <article key={channel.servedOm.id} className="institutional-support-card">
                      <div className="institutional-support-card__head">
                        <h3>{channel.servedOm.code}</h3>
                      </div>
                      {inherited ? <p className="institutional-coverage-note"><ShieldRoundedIcon /> Atendida pela CPCA {channel.responsibleCpca.code}</p> : <p className="institutional-coverage-note is-own"><ShieldRoundedIcon /> CPCA própria</p>}
                      <div className="institutional-support-card__links">
                        {channel.email ? <a href={`mailto:${channel.email}`}><EmailRoundedIcon /><span><small>E-mail</small>{channel.email}</span></a> : null}
                        {channel.intraerUrl ? <a href={channel.intraerUrl} target="_blank" rel="noreferrer"><OpenInNewRoundedIcon /><span><small>Página</small>Acessar na Intraer</span></a> : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <EmptyInstitutionalState>Nenhum canal foi encontrado para a busca informada.</EmptyInstitutionalState>
            )}
          </div>
        </section>

        <section id="biblioteca" className="institutional-section institutional-library-section">
          <div className="institutional-container">
            <div className="institutional-library-head">
              <SectionHeading
                eyebrow="Acervo fotográfico"
                title="Biblioteca"
                text="Registros das frentes SMIF e CIPAVD publicados na Biblioteca do sistema."
              />
              <div className="institutional-filter-row" aria-label="Filtrar biblioteca por frente">
                {(["ALL", "CIPAVD", "SMIF"] as const).map((scope) => (
                  <button key={scope} type="button" className={libraryScope === scope ? "is-active" : ""} onClick={() => setLibraryScope(scope)}>
                    {scope === "ALL" ? "Todo o acervo" : scope}
                  </button>
                ))}
              </div>
            </div>
            {libraryGroups.length ? (
              <div className="institutional-gallery-groups">
                {libraryGroups.map((group) => (
                  <article key={group.id} className="institutional-gallery-group">
                    <div className="institutional-gallery-group__head">
                      <div><span className={`institutional-scope-chip is-${group.scope.toLowerCase()}`}>{group.scope}</span><h3>{group.title}</h3></div>
                      <span><PhotoLibraryRoundedIcon /> {group.photos.length} foto(s)</span>
                    </div>
                    <div className="institutional-gallery-grid">
                      {group.photos.slice(0, 8).map((photo) => (
                        <button key={photo.id} type="button" onClick={() => setLightbox(photo)} aria-label={`Ampliar ${photo.title || "foto do acervo"}`}>
                          <img src={toApiUrl(photo.imageUrl)} alt={photo.title || `Registro fotográfico ${group.title}`} loading="lazy" />
                          {photo.title ? <span>{photo.title}</span> : null}
                        </button>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyInstitutionalState>As fotos aparecerão aqui quando forem incluídas na Biblioteca.</EmptyInstitutionalState>
            )}
          </div>
        </section>
      </main>

      <footer className="institutional-footer">
        <div className="institutional-container institutional-footer__grid">
          <div className="institutional-footer__brand"><img src="/brand/cipavd-7.png" alt="" /><div><strong>CIPAVD</strong><span>Comissão Itinerante de Prevenção ao Assédio e à Violência Doméstica</span></div></div>
          <div><strong>Navegação</strong>{NAV_ITEMS.slice(0, 4).map(([label, anchor]) => <a key={anchor} href={`#${anchor}`}>{label}</a>)}</div>
          <div><strong>Informação e apoio</strong>{NAV_ITEMS.slice(4).map(([label, anchor]) => <a key={anchor} href={`#${anchor}`}>{label}</a>)}</div>
          <div><strong>Acesso restrito</strong><p>Área de gestão destinada aos usuários autorizados.</p><Link to="/login">Entrar no sistema <ArrowForwardRoundedIcon /></Link></div>
        </div>
        <div className="institutional-container institutional-footer__bottom"><span>Comando-Geral do Pessoal • Força Aérea Brasileira</span></div>
      </footer>

      {lightbox ? (
        <div className="institutional-lightbox" role="dialog" aria-modal="true" aria-label={lightbox.title || "Foto ampliada"} onClick={() => setLightbox(null)}>
          <button type="button" aria-label="Fechar foto" onClick={() => setLightbox(null)}><CloseRoundedIcon /></button>
          <figure onClick={(event) => event.stopPropagation()}><img src={toApiUrl(lightbox.imageUrl)} alt={lightbox.title || "Foto do acervo"} />{lightbox.title ? <figcaption>{lightbox.title}</figcaption> : null}</figure>
        </div>
      ) : null}
    </div>
  );
}
