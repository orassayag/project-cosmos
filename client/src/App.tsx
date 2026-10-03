import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { APP_VERSION } from 'virtual:app-version';

import { ProjectCosmosMap } from './map/Map';
import { DomainBar } from './components/DomainBar';
import { ScenarioStatus } from './components/ScenarioStatus';
import { PlaybackControls } from './components/PlaybackControls';
import { StepPanel } from './components/StepPanel';
import { ActivityLog } from './components/ActivityLog';
import { IntroOverlay } from './components/IntroOverlay';
import { WarpTransition } from './components/WarpTransition';
import { CosmosLoadError } from './components/CosmosLoadError';
import { CosmosProvider, useCosmos } from './api/CosmosProvider';
import { useCosmosLoad } from './api/useCosmosLoad';
import { indexCosmos, nodeKindOf, useCosmosIndex } from './api/cosmosIndex';
import type { DriftEntry, Incident, Step } from './api/cosmos-api';
import { HelpButton } from './components/HelpButton';
import { HelpModal } from './components/HelpModal';
import { DriftFooter } from './components/DriftFooter';
import { AgentButton } from './components/AgentButton';
import { AskPanel } from './components/AskPanel';
import type { AskAction } from './components/AskPanel';
import { warnUnknownAskAction } from './components/askStream';
import { ConnectAgentModal } from './components/ConnectAgentModal';
import { DemoCaption } from './components/DemoCaption';
import { DemoPointer } from './components/DemoPointer';
import { IncidentBar } from './components/IncidentBar';
import { IncidentBanner } from './components/IncidentBanner';
import { ChangelogPanel, projectCosmosStateFor } from './components/ChangelogPanel';
import type { ChangelogActivation, ChangelogFocus, ProjectCosmosState } from './components/ChangelogPanel';
import { Spotlight } from './components/Spotlight';
import type { SpotlightTarget } from './components/Spotlight';
import { BrandStarfield } from './map/BrandStarfield';
import { MobileMenu } from './components/MobileMenu';
import { OverlayProvider, useOverlay, useOverlayManager, OVERLAY } from './overlays/OverlayManager';
import { MOBILE_QUERY, useViewport } from './hooks/useViewport';
import { useAiConnection } from './hooks/useAiConnection';
import type { AiConnection } from './hooks/useAiConnection';
import { INTRO_SEEN_STORAGE_KEY, readDemoMode, shouldShowIntro } from './demo/demoMode';
import { buildDemoScript } from './demo/scripts';
import { buildDemoScriptedAnswer } from './demo/scriptedAnswer';
import type { DemoScriptedAnswer } from './demo/types';
import { useDemoAiConnection } from './demo/useDemoAiConnection';
import { useDemoRunner } from './demo/useDemoRunner';

import { useScenarioRunner } from './player/runner';
import type { Shot } from './player/runner';
import { readInitialDeepLink, resolvePlayableId, useDeepLink } from './hooks/useDeepLink';
import { driftRunDateTime } from './theme/driftRuns';

interface ActivityEntry { idx: number; step: Step }

export function App() {
  const initial = useMemo(readInitialDeepLink, []);
  const demoMode = useMemo(() => readDemoMode(window.location.href), []);
  // The layout is read once at load: a script that changed mid-run would restart it.
  const [demoLayout] = useState(() => ({ isPhone: window.matchMedia(MOBILE_QUERY).matches }));
  const demoSpeed = demoMode?.speed ?? 1;
  const [showIntro, setShowIntro] = useState(() => shouldShowIntro(
    demoMode,
    localStorage,
    initial.scenario != null || initial.incident != null || initial.domain != null,
  ));
  // Plays the hyperspace warp between the intro CTA and the cosmos shell.
  const [warping, setWarping] = useState(false);
  const cosmosLoad = useCosmosLoad();
  const cosmosResponse = cosmosLoad.state.status === 'ready' ? cosmosLoad.state.response : null;
  const cosmosIndex = cosmosResponse ? indexCosmos(cosmosResponse) : null;
  const isCosmosReady = cosmosResponse !== null;
  const demoScript = useMemo(
    () => (demoMode && cosmosResponse ? buildDemoScript(cosmosResponse, demoMode.mode, demoLayout) : undefined),
    [demoMode, cosmosResponse, demoLayout],
  );
  const demoScriptedAnswer = useMemo(
    () => (demoMode && cosmosResponse ? buildDemoScriptedAnswer(cosmosResponse.data.demo.aiTour, demoLayout) : undefined),
    [demoMode, cosmosResponse, demoLayout],
  );
  const defaultDomainId = cosmosResponse?.data.domains[0]?.id ?? null;
  // null = no pick yet, which shows the first domain once the data has loaded.
  const [pickedDomain, setActiveDomain] = useState<string | null>(() => initial.domain);
  const activeDomain = pickedDomain ?? defaultDomainId ?? '';

  const runner = useScenarioRunner(cosmosResponse);
  const { state, steps, scenario, setScenario, jumpTo, completeCurrentShot, onShot } = runner;

  // Hydrate from deep link on the shell's first paint (it mounts once the data is ready),
  // so the map frames the scenario exactly as it did before the loading gate.
  // An incident id wins over a scenario id — both resolve into the same runner slot.
  const isShellShown = isCosmosReady && !showIntro && !warping;
  const hasHydratedDeepLinkRef = useRef(false);
  useEffect(() => {
    if (!isShellShown || !cosmosIndex || hasHydratedDeepLinkRef.current) return;
    hasHydratedDeepLinkRef.current = true;
    const deepLinkId =
      resolvePlayableId(initial.incident, cosmosIndex) ?? resolvePlayableId(initial.scenario, cosmosIndex);
    if (deepLinkId) {
      setScenario(deepLinkId);
      if (initial.step != null) {
        // Defer so steps array is populated.
        queueMicrotask(() => jumpTo(initial.step!));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isShellShown]);

  // The active playable resolved as an incident (null for scenarios / idle).
  const activeIncident: Incident | null =
    state.scenarioId != null ? cosmosIndex?.incidentsById[state.scenarioId] ?? null : null;

  // Push UI state into the URL — incidents use `?incident=`, scenarios `?scenario=`.
  useDeepLink({
    domain: activeDomain,
    scenario: activeIncident ? null : state.scenarioId,
    incident: activeIncident ? activeIncident.id : null,
    step: state.idx >= 0 ? state.idx : null,
    defaultDomainId,
  });

  // Latest shot from the runner — drives the comet animation in Map.
  const [shot, setShot] = useState<Shot | null>(null);
  const [history, setHistory] = useState<ActivityEntry[]>([]);
  const [spotlightTarget, setSpotlightTarget] = useState<SpotlightTarget | null>(null);
  // The step explainer panel can be dismissed by the user; it auto-reopens
  // whenever the user navigates (next/prev/dot/play) or picks a new scenario.
  const [panelOpen, setPanelOpen] = useState(true);

  // Single-slot manager so no modal/overlay ever overrides another (a stack on phones).
  const overlay = useOverlayManager();
  const { isMobile } = useViewport();
  // A changelog item warps to its affected node: play the hyperspace effect,
  // then land the map on the node once the warp finishes.
  const [warp, setWarp] = useState<ChangelogActivation | null>(null);
  // The commit/branch the map is currently framed on (set after a warp), shown
  // beside the title so you always know which state you're looking at.
  const [projectCosmosState, setProjectCosmosState] = useState<ProjectCosmosState | null>(null);
  // The run date currently in view — the shared cursor the Changelog and the
  // Changes panel both write, so a pick in one filters and stamps the other.
  const [driftDate, setDriftDate] = useState<string | null>(null);
  // Bumped by the "Project Cosmos" title to force the map back to its initial state.
  const [resetNonce, setResetNonce] = useState(0);

  useEffect(() => {
    return onShot((s) => {
      setShot(s);
      // Append every step in the shot to the activity log (keep them in order).
      setHistory((h) => {
        const baseIdx = s.startIdx;
        const additions = s.steps.map((step, i) => ({ idx: baseIdx + i, step }));
        // Avoid duplicates if the same shot fires twice (e.g. user clicks Next mid-play).
        const lastIdx = h.length > 0 ? h[h.length - 1].idx : -1;
        const filtered = additions.filter((a) => a.idx > lastIdx);
        return [...h, ...filtered];
      });
    });
  }, [onShot]);

  const handleShotComplete = useCallback(
    (token: number) => {
      // Ignore late callbacks from invalidated shots.
      if (shot && token !== shot.token) return;
      completeCurrentShot();
    },
    [shot, completeCurrentShot],
  );

  const handlePickScenario = useCallback(
    (scenarioId: string) => {
      setScenario(scenarioId);
      setHistory([]);
      setShot(null);
      setPanelOpen(true);
    },
    [setScenario],
  );

  // Wrap navigation actions so they reopen the explainer panel if it
  // was dismissed. The user clicking a dot / next / prev / play is a
  // strong signal they want to see the description again.
  const navPrev    = useCallback(() => { setPanelOpen(true); runner.prev(); }, [runner]);
  const navNext    = useCallback(() => { setPanelOpen(true); runner.next(); }, [runner]);
  const navJump    = useCallback((i: number) => { setPanelOpen(true); runner.jumpTo(i); }, [runner]);
  const navPlay    = useCallback(() => { setPanelOpen(true); runner.play(); }, [runner]);
  // Restart: rewind to step 0 and play. Also clears the activity log so
  // it doesn't show entries from the last run.
  const navRestart = useCallback(() => {
    setPanelOpen(true);
    setHistory([]);
    setShot(null);
    runner.jumpTo(0);
    // jumpTo flips state to non-playing; defer play so the index update
    // is committed before play() reads it.
    queueMicrotask(() => runner.play());
  }, [runner]);

  // The runner only exposes the new scenario's steps after the next render, so
  // playback starts from an effect once the picked id is actually loaded.
  const pendingAutoplayIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (pendingAutoplayIdRef.current === null) return;
    if (pendingAutoplayIdRef.current !== state.scenarioId || steps.length === 0) return;
    pendingAutoplayIdRef.current = null;
    navPlay();
  }, [state.scenarioId, steps, navPlay]);

  const handlePlayScenario = useCallback(
    (id: string) => {
      const playableId = cosmosIndex ? resolvePlayableId(id, cosmosIndex) : null;
      if (!playableId) return;
      if (playableId === state.scenarioId) {
        navRestart();
        return;
      }
      pendingAutoplayIdRef.current = playableId;
      handlePickScenario(playableId);
    },
    [cosmosIndex, state.scenarioId, navRestart, handlePickScenario],
  );

  const handlePickDomain = useCallback(
    (domainId: string) => {
      // Browsing other domains shouldn't kill the active scenario —
      // it stays running / framed until the user explicitly picks a
      // different scenario from the dropdown (or hits ESC).
      setActiveDomain(domainId);
    },
    [],
  );

  // A whole changelog item was clicked: close the changelog and kick off the
  // hyperspace warp toward the item's affected node.
  const handleActivateChangelogItem = useCallback(
    (activation: ChangelogActivation) => {
      if (!isMobile) overlay.close(OVERLAY.changelog);
      setWarp(activation);
    },
    [overlay, isMobile],
  );

  // Warp finished — land the map on the node the item pointed at and record
  // the commit/branch it represents so the title can show where we are.
  const handleWarpDone = useCallback(() => {
    if (warp) {
      setSpotlightTarget(warp.target);
      setProjectCosmosState(warp.state);
      setDriftDate(warp.date);
    }
    setWarp(null);
  }, [warp]);

  // A Changes side-panel entry was clicked: warp to its affected node exactly
  // like a changelog item, so both surfaces share the same hyperspace landing.
  // When the entry touches no live node, fall back to just stamping the cursor.
  const handleSelectDrift = useCallback((entry: DriftEntry) => {
    const nodeId = entry.nodeIds[0];
    const target: SpotlightTarget | null = nodeId && cosmosIndex
      ? { id: nodeId, kind: nodeKindOf(cosmosIndex, nodeId) === 'topic' ? 'topic' : 'service' }
      : null;
    if (target) {
      setWarp({ target, state: projectCosmosStateFor(entry), date: entry.date });
    } else {
      setProjectCosmosState(projectCosmosStateFor(entry));
      setDriftDate(entry.date);
    }
  }, [cosmosIndex]);

  // The "Project Cosmos" title resets the galaxy to its initial state: no scenario,
  // no domain tab selected, cleared history/URL params, every overlay closed,
  // map reframed.
  const handleResetGalaxy = useCallback(() => {
    setScenario(null);
    setHistory([]);
    setShot(null);
    setPanelOpen(true);
    setActiveDomain('');
    setSpotlightTarget(null);
    setWarp(null);
    setProjectCosmosState(null);
    setDriftDate(null);
    overlay.reset();
    setResetNonce((n) => n + 1);
  }, [setScenario, overlay]);

  // ESC resets the whole galaxy — clears the scenario, filters, selection,
  // overlays and URL, and reframes the map to home. Skipped while a modal
  // (help / changelog / spotlight) is open, since each closes on its own Esc.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (e.target && (e.target as HTMLElement).matches('input, textarea, [contenteditable="true"]')) return;
      if (document.querySelector('.lc-help-overlay, .lc-changelog-backdrop, .lc-spotlight-backdrop')) return;
      handleResetGalaxy();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleResetGalaxy]);

  // The ask state lives here, not in the shell, because the demo runner asks questions too.
  const [askQuestion, setAskQuestion] = useState<string | null>(null);
  const [askNonce, setAskNonce] = useState(0);
  // The nodes the map "focuses" on while the answer shows: the list starts empty
  // and the agent's highlight actions fill it. The focus only engages once the
  // answer starts (not during "thinking").
  const [askFocusIds, setAskFocusIds] = useState<string[]>([]);
  const [askAnswering, setAskAnswering] = useState(false);
  const [askScriptedAnswer, setAskScriptedAnswer] = useState<DemoScriptedAnswer | undefined>(undefined);
  const openAskPanel = useCallback(
    (question: string, focusIds: string[], scriptedAnswer?: DemoScriptedAnswer) => {
      setAskQuestion(question);
      setAskNonce((n) => n + 1);
      setAskFocusIds(focusIds);
      setAskScriptedAnswer(scriptedAnswer);
      setAskAnswering(false);
      overlay.open(OVERLAY.ask);
    },
    [overlay],
  );
  const handleAnswerStart = useCallback(() => setAskAnswering(true), []);
  // Surfaces an Ask action opens sit above the answer, which keeps streaming beneath them
  // (buried on phones, hidden on desktop) and comes back when they close. Unknown ids are no-ops.
  const [blastRequest, setBlastRequest] = useState<{ nodeId: string } | null>(null);
  const [changelogFocus, setChangelogFocus] = useState<ChangelogFocus | null>(null);
  const handleBlastRequestConsumed = useCallback(() => setBlastRequest(null), []);
  const handleAskAction = useCallback((action: AskAction) => {
    if (!cosmosIndex) return;
    switch (action.kind) {
      case 'highlight':
        setAskFocusIds(action.serviceIds.filter((id) => nodeKindOf(cosmosIndex, id) !== null));
        return;
      case 'playScenario':
        handlePlayScenario(action.scenarioId);
        return;
      case 'showBlastRadius':
        if (nodeKindOf(cosmosIndex, action.nodeId)) setBlastRequest({ nodeId: action.nodeId });
        return;
      case 'openPassport': {
        const kind = nodeKindOf(cosmosIndex, action.nodeId);
        if (kind) setSpotlightTarget({ id: action.nodeId, kind, keepAsk: true });
        return;
      }
      case 'showHealth':
        overlay.open(OVERLAY.mapHealth, { keepBeneath: true });
        return;
      case 'showOwnership':
        overlay.open(OVERLAY.mapOwnership, { keepBeneath: true });
        return;
      case 'openChangelogEntry':
        if (!cosmosResponse?.data.drift.entries.some((entry) => entry.id === action.entryId)) return;
        setChangelogFocus((previous) => ({ entryId: action.entryId, requestId: (previous?.requestId ?? 0) + 1 }));
        overlay.open(OVERLAY.changelog, { keepBeneath: true });
        return;
      default:
        warnUnknownAskAction((action as { kind?: unknown }).kind);
    }
  }, [cosmosIndex, cosmosResponse, handlePlayScenario, overlay]);

  const handleIntroStart = useCallback(() => {
    if (!demoMode) localStorage.setItem(INTRO_SEEN_STORAGE_KEY, '1');
    setWarping(true);
  }, [demoMode]);

  const demoAi = useDemoAiConnection();
  const demoRunner = useDemoRunner({
    script: demoScript,
    speed: demoSpeed,
    onEnd: () => overlay.close(OVERLAY.connect),
  });
  const isDemoActive = demoRunner.isActive;
  const demoOverlays = demoMode && (
    <>
      <DemoPointer pointer={demoRunner.pointer} isVisible={demoRunner.isOverlayVisible} speed={demoSpeed} />
      <DemoCaption caption={demoRunner.caption} isVisible={demoRunner.isOverlayVisible} speed={demoSpeed} />
    </>
  );

  // Checked only once the shell shows (as before the demo existed), and never while the demo runs.
  const realAi = useAiConnection({ enabled: !isDemoActive && isShellShown });
  const aiConnection: AiConnection = isDemoActive ? demoAi : realAi;
  const handleAsk = useCallback((question: string) => {
    // The demo's question goes through the real Search; only the answer is scripted.
    openAskPanel(question, [], isDemoActive ? demoScriptedAnswer : undefined);
  }, [openAskPanel, isDemoActive, demoScriptedAnswer]);
  const handleOpenAgentChat = useCallback(() => {
    // A mounted answer is only re-surfaced: remounting it would ask the agent again.
    if (askQuestion !== null && overlay.isStacked(OVERLAY.ask)) overlay.open(OVERLAY.ask);
    else openAskPanel('', []);
  }, [askQuestion, overlay, openAskPanel]);

  // Any active scenario isolates the map — the moment a scenario is
  // picked, fade everything outside its touch set so the active flow
  // is the only thing the eye lands on.
  const isolate = !!state.scenarioId;

  // Map is mounted ONLY after the intro CTA fires — otherwise the canvas
  // briefly paints behind the overlay on first render.
  // The warp can run UNDER the intro while it fades — so the user
  // sees hyperspace ignite first and the intro dissolves to reveal it.
  if (showIntro || warping) {
    return (
      <>
        {warping && (
          <WarpTransition hold={cosmosLoad.state.status === 'loading'} onDone={() => setWarping(false)} />
        )}
        {showIntro && (
          <IntroOverlay
            tagline={cosmosResponse?.data.brand.tagline}
            onStart={handleIntroStart}
            onExitComplete={() => setShowIntro(false)}
          />
        )}
        {demoOverlays}
      </>
    );
  }

  if (cosmosLoad.state.status === 'loading') {
    return (
      <>
        <WarpTransition hold />
        {demoOverlays}
      </>
    );
  }

  if (cosmosLoad.state.status === 'error') {
    return <CosmosLoadError errorCode={cosmosLoad.state.errorCode} onRetry={cosmosLoad.retry} />;
  }

  return (
    <CosmosProvider response={cosmosLoad.state.response}>
      <OverlayProvider value={overlay}>
        <ProjectCosmosShell
          activeDomain={activeDomain}
          runner={runner}
          state={state}
          steps={steps}
          scenario={scenario}
          shot={shot}
          history={history}
          panelOpen={panelOpen}
          setPanelOpen={setPanelOpen}
          handlePickDomain={handlePickDomain}
          handlePickScenario={handlePickScenario}
          handleShotComplete={handleShotComplete}
          isolate={isolate}
          setHistory={setHistory}
          navPlay={navPlay}
          navPrev={navPrev}
          navNext={navNext}
          navJump={navJump}
          navRestart={navRestart}
          spotlightTarget={spotlightTarget}
          setSpotlightTarget={setSpotlightTarget}
          blastRequest={blastRequest}
          onBlastRequestConsumed={handleBlastRequestConsumed}
          changelogFocus={changelogFocus}
          warping={!!warp}
          onWarpDone={handleWarpDone}
          onActivateChangelogItem={handleActivateChangelogItem}
          onResetGalaxy={handleResetGalaxy}
          projectCosmosState={projectCosmosState}
          driftDate={driftDate}
          onSelectDrift={handleSelectDrift}
          resetNonce={resetNonce}
          activeIncident={activeIncident}
          aiConnection={aiConnection}
          askQuestion={askQuestion}
          askNonce={askNonce}
          askFocusIds={askAnswering ? askFocusIds : []}
          askScriptedAnswer={askScriptedAnswer}
          onAsk={handleAsk}
          onOpenAgentChat={handleOpenAgentChat}
          onAnswerStart={handleAnswerStart}
          onAskAction={handleAskAction}
        />
        {demoOverlays}
      </OverlayProvider>
    </CosmosProvider>
  );
}

interface ProjectCosmosShellProps {
  activeDomain: string;
  runner: ReturnType<typeof useScenarioRunner>;
  state: ReturnType<typeof useScenarioRunner>['state'];
  steps: Step[];
  scenario: ReturnType<typeof useScenarioRunner>['scenario'];
  shot: Shot | null;
  history: ActivityEntry[];
  panelOpen: boolean;
  setPanelOpen: (v: boolean) => void;
  handlePickDomain: (d: string) => void;
  handlePickScenario: (s: string) => void;
  handleShotComplete: (token: number) => void;
  isolate: boolean;
  setHistory: (v: ActivityEntry[]) => void;
  navPlay: () => void;
  navPrev: () => void;
  navNext: () => void;
  navJump: (i: number) => void;
  navRestart: () => void;
  spotlightTarget: SpotlightTarget | null;
  setSpotlightTarget: (t: SpotlightTarget | null) => void;
  blastRequest: { nodeId: string } | null;
  onBlastRequestConsumed: () => void;
  changelogFocus: ChangelogFocus | null;
  warping: boolean;
  onWarpDone: () => void;
  onActivateChangelogItem: (activation: ChangelogActivation) => void;
  onResetGalaxy: () => void;
  projectCosmosState: ProjectCosmosState | null;
  driftDate: string | null;
  onSelectDrift: (entry: DriftEntry) => void;
  resetNonce: number;
  activeIncident: Incident | null;
  aiConnection: AiConnection;
  askQuestion: string | null;
  askNonce: number;
  askFocusIds: string[];
  askScriptedAnswer: DemoScriptedAnswer | undefined;
  onAsk: (question: string) => void;
  onOpenAgentChat: () => void;
  onAnswerStart: () => void;
  onAskAction: (action: AskAction) => void;
}

function ProjectCosmosShell(p: ProjectCosmosShellProps) {
  // The first ~2.6s after the CTA we run the "ignite" sequence.
  const [revealing, setRevealing] = useState(true);
  useEffect(() => {
    const t = window.setTimeout(() => setRevealing(false), 2600);
    return () => window.clearTimeout(t);
  }, []);

  const {
    activeDomain, runner, state, steps, scenario, shot, history,
    panelOpen, setPanelOpen, handlePickDomain, handlePickScenario,
    handleShotComplete, isolate, setHistory, navPlay, navPrev, navNext, navJump, navRestart,
    spotlightTarget, setSpotlightTarget, blastRequest, onBlastRequestConsumed, changelogFocus,
    warping, onWarpDone, onActivateChangelogItem, onResetGalaxy, projectCosmosState, resetNonce,
    driftDate, onSelectDrift,
    activeIncident,
    aiConnection, askQuestion, askNonce, askFocusIds, askScriptedAnswer,
    onAsk, onOpenAgentChat, onAnswerStart, onAskAction,
  } = p;

  // Presentation mode: hide the chrome and fatten the comets for talks.
  const [presentation, setPresentation] = useState(false);

  // On phone-class viewports the topbar's secondary chrome collapses into a
  // slide-over drawer toggled from a hamburger.
  const { isMobile } = useViewport();
  const [menuOpen, setMenuOpen] = useState(false);
  // Close the drawer whenever navigation moves the app to a new surface.
  useEffect(() => { setMenuOpen(false); }, [state.scenarioId, presentation]);
  useEffect(() => { if (!isMobile) setMenuOpen(false); }, [isMobile]);

  // Every mutually-exclusive surface (changelog + the map overlays) flows
  // through this single-slot manager so none can override another.
  const overlay = useOverlay();

  // The answer panel is a managed overlay so it can never stack with the star
  // inspector or any other surface — opening one closes the rest.
  const { servicesById } = useCosmosIndex();
  const { runTimeUtc: driftRunTimeUtc } = useCosmos().data.drift;
  const handleOpenAgentSetup = useCallback(() => overlay.open(OVERLAY.connect), [overlay]);
  const closeHelp = useCallback(() => overlay.close(OVERLAY.help), [overlay]);

  // The current step, exposed to the incident panel so its body tracks playback.
  const currentStep =
    state.idx >= 0 && state.idx < steps.length ? steps[state.idx] : null;

  // The star the incident's LAST hop targets — the one that will blow up, but
  // ONLY once its meteor actually lands. Null unless we're on the last step and
  // it lands on a service (topics are light nodes, not stars). This is just the
  // "watch" target handed to the comet layer, not the detonation itself.
  const explodeTargetId = useMemo(() => {
    if (!activeIncident || steps.length === 0) return null;
    if (state.idx !== steps.length - 1) return null;
    const last = steps[steps.length - 1];
    if (servicesById[last.to]) return last.to;
    if (servicesById[last.from]) return last.from;
    return null;
  }, [activeIncident, state.idx, steps, servicesById]);

  // The star that HAS detonated — set only when the meteor reaches it. Cleared
  // whenever the target changes (new incident, moved off the last step) so a
  // fresh star stays intact until its own meteor strikes.
  const [explodedStarId, setExplodedStarId] = useState<string | null>(null);
  useEffect(() => { setExplodedStarId(null); }, [explodeTargetId]);
  const handleStarHit = useCallback((nodeId: string) => setExplodedStarId(nodeId), []);

  // Esc leaves presentation mode and does nothing else — captured on window
  // ahead of the bubble-phase Esc handlers (galaxy reset, map deselect).
  useEffect(() => {
    if (!presentation) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      setPresentation(false);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [presentation]);

  // Same surface the bot opens: the answer panel when connected, the setup window otherwise.
  const toggleAgent = useCallback(() => {
    if (aiConnection.status === 'connected') {
      if (overlay.isOpen(OVERLAY.ask)) overlay.close(OVERLAY.ask);
      else onOpenAgentChat();
    } else {
      overlay.toggle(OVERLAY.connect);
    }
  }, [aiConnection.status, overlay, onOpenAgentChat]);

  // Keyboard: P toggles presentation, A the agent; arrows / space drive playback so the
  // deck is navigable once the on-screen controls are hidden.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target && (e.target as HTMLElement).matches('input, textarea, [contenteditable="true"]')) return;
      if (e.key === 'p' || e.key === 'P') { setPresentation((v) => !v); return; }
      if ((e.key === 'a' || e.key === 'A') && !e.metaKey && !e.ctrlKey && !e.altKey) { toggleAgent(); return; }
      if (!state.scenarioId) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); navNext(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); navPrev(); }
      else if (e.key === ' ') {
        e.preventDefault();
        if (state.playing) runner.pause();
        else navPlay();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.scenarioId, state.playing, navNext, navPrev, navPlay, runner, toggleAgent]);

  return (
    <div
      className="lc-app"
      data-revealing={revealing ? 'true' : 'false'}
      data-presentation={presentation ? 'true' : 'false'}
    >
      {/* Always-on sparkle starfield — sits behind everything. */}
      <div className="lc-app-bg" aria-hidden="true">
        <BrandStarfield density={0.1} speed={1.2} shootingEvery={60} />
      </div>

      {/* Brief radial flash that washes the scene during the reveal. */}
      {revealing && <div className="lc-reveal-flash" aria-hidden="true" />}

      {(() => {
        const brandBlock = (
          <>
            <button
              type="button"
              className="lc-topbar-brand lc-topbar-brand--reset"
              data-demo-target="galaxy-reset"
              onClick={onResetGalaxy}
              title="Reset the galaxy — clear the current scenario, filters and URL"
            >
              <span className="lc-topbar-logo">
                <img className="lc-topbar-logo-emblem" src={`${import.meta.env.BASE_URL}logo-emblem.png`} alt="" />
                <img className="lc-topbar-logo-wordmark" src={`${import.meta.env.BASE_URL}logo-wordmark.png`} alt="Project Cosmos" />
              </span>
              <span className="lc-topbar-version">v{APP_VERSION}</span>
            </button>
            {(projectCosmosState || driftDate) && (
              <span
                className="lc-cosmos-state"
                title={
                  projectCosmosState
                    ? `Viewing ${projectCosmosState.title} — ${projectCosmosState.repo}@${projectCosmosState.sha} on ${projectCosmosState.branch}`
                    : 'Current point in the drift history'
                }
              >
                {driftDate && (
                  <span className="lc-cosmos-state-time">
                    <svg className="lc-cosmos-state-clock" width={11} height={11} viewBox="0 0 12 12" aria-hidden="true">
                      <circle cx={6} cy={6} r={4.6} fill="none" stroke="currentColor" strokeWidth={1} />
                      <path d="M6 3.4 V6 L7.8 7.2" fill="none" stroke="currentColor" strokeWidth={1} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {driftRunDateTime(driftDate, driftRunTimeUtc)}
                  </span>
                )}
                {projectCosmosState && (
                  <span className="lc-cosmos-state-commit">
                    <svg className="lc-cosmos-state-icon" width={12} height={12} viewBox="0 0 12 12" aria-hidden="true">
                      <path d="M3 1.5 v9 M3 4 a2.5 2.5 0 0 0 2.5 2.5 h1.5 M9 1.5 a1.5 1.5 0 1 1 0 3 a1.5 1.5 0 0 1 0 -3 Z M3 1.5 a1.5 1.5 0 1 1 0 0.01 Z M3 10.5 a1.5 1.5 0 1 1 0 0.01 Z"
                        fill="none" stroke="currentColor" strokeWidth={1} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="lc-cosmos-state-branch">{projectCosmosState.branch}</span>
                    <span className="lc-cosmos-state-sep">·</span>
                    <span className="lc-cosmos-state-sha">{projectCosmosState.repo}@{projectCosmosState.sha}</span>
                    {projectCosmosState.owner && (
                      <span className="lc-cosmos-state-owner">@{projectCosmosState.owner}</span>
                    )}
                  </span>
                )}
              </span>
            )}
          </>
        );

        // On mobile, picking a scenario from the drawer dismisses it; picking a
        // domain only expands its scenario list, same as the desktop sub-menu.
        const pickScenarioAndClose = isMobile
          ? (id: string) => { handlePickScenario(id); setMenuOpen(false); }
          : handlePickScenario;

        const domainNav = (
          <>
            <DomainBar
              active={activeDomain}
              activeScenarioId={state.scenarioId}
              inline={isMobile}
              onPickDomain={handlePickDomain}
              onPickScenario={pickScenarioAndClose}
              resetNonce={resetNonce}
            />
            <IncidentBar
              activeScenarioId={state.scenarioId}
              onPickIncident={pickScenarioAndClose}
              resetNonce={resetNonce}
            />
          </>
        );

        const secondaryActions = (
          <>
            <DriftFooter />
            <button
              type="button"
              className="lc-present-btn"
              onClick={() => { overlay.open(OVERLAY.changelog); setMenuOpen(false); }}
              title="Architecture changelog — what Drift Sync has caught"
            >
              Changelog
            </button>
            <button
              type="button"
              className="lc-present-btn"
              onClick={() => setPresentation(true)}
              title="Presentation mode — hide chrome for talks (P)"
            >
              Present
            </button>
            <HelpButton onOpen={() => { overlay.open(OVERLAY.help); setMenuOpen(false); }} />
          </>
        );

        if (isMobile) {
          return (
            <header className="lc-topbar lc-topbar--mobile">
              <div className="lc-topbar-row">
                <div className="lc-topbar-side lc-topbar-side--left">{brandBlock}</div>
                <div className="lc-topbar-side lc-topbar-side--right">
                  <ScenarioStatus domainId={activeDomain} activeScenarioId={state.scenarioId} />
                  <button
                    type="button"
                    className="lc-menu-toggle"
                    data-demo-target="menu-open"
                    aria-label="Open menu"
                    aria-expanded={menuOpen}
                    onClick={() => setMenuOpen(true)}
                  >
                    <span /><span /><span />
                  </button>
                </div>
              </div>
              <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)}>
                <div className="lc-mobile-menu-section">
                  <div className="lc-mobile-menu-label">Explore</div>
                  <div className="lc-mobile-menu-nav">{domainNav}</div>
                </div>
                <div className="lc-mobile-menu-section">
                  <div className="lc-mobile-menu-label">Tools</div>
                  <div className="lc-mobile-menu-actions">{secondaryActions}</div>
                </div>
              </MobileMenu>
            </header>
          );
        }

        return (
          <header className="lc-topbar">
            <div className="lc-topbar-row">
              <div className="lc-topbar-side lc-topbar-side--left">
                {brandBlock}
                {domainNav}
              </div>
              <div className="lc-topbar-center">
                <ScenarioStatus domainId={activeDomain} activeScenarioId={state.scenarioId} />
              </div>
              <div className="lc-topbar-side lc-topbar-side--right">
                {secondaryActions}
              </div>
            </div>
          </header>
        );
      })()}

      <div className="lc-stage">
        <ProjectCosmosMap
          activeScenarioId={state.scenarioId}
          shot={shot}
          speed={state.speed}
          onShotComplete={handleShotComplete}
          isolate={isolate}
          revealing={revealing}
          presentation={presentation}
          spotlightTarget={spotlightTarget}
          onSpotlightConsumed={() => setSpotlightTarget(null)}
          blastRequest={blastRequest}
          onBlastRequestConsumed={onBlastRequestConsumed}
          resetNonce={resetNonce}
          askFocusIds={askFocusIds}
          incidentActive={!!activeIncident}
          explodeNodeId={explodedStarId}
          explodeTargetId={explodeTargetId}
          onStarHit={handleStarHit}
          activeDomain={activeDomain}
          driftCursorDate={driftDate}
          onDriftSelect={onSelectDrift}
        />

        <IncidentBanner
          incident={activeIncident}
          step={activeIncident ? currentStep : null}
          stepIndex={state.idx}
          stepCount={steps.length}
          onClose={onResetGalaxy}
        />

        <StepPanel
          scenario={scenario}
          steps={steps}
          idx={state.idx}
          open={panelOpen}
          onPrev={navPrev}
          onNext={navNext}
          onClose={() => setPanelOpen(false)}
        />

        <ActivityLog
          history={history}
          visible={!!scenario && history.length > 0}
          onClear={() => setHistory([])}
        />

        {overlay.isStacked(OVERLAY.ask) && askQuestion !== null && (
          <AskPanel
            key={askNonce}
            question={askQuestion}
            onAsk={onAsk}
            hidden={!overlay.isOpen(OVERLAY.ask)}
            onClose={() => overlay.close(OVERLAY.ask)}
            onAnswerStart={onAnswerStart}
            onAction={onAskAction}
            scriptedAnswer={askScriptedAnswer}
          />
        )}

        <AgentButton
          status={aiConnection.status}
          provider={aiConnection.provider}
          onOpenChat={onOpenAgentChat}
          onOpenSetup={handleOpenAgentSetup}
        />

        <PlaybackControls
          runner={runner}
          steps={steps}
          onPlay={navPlay}
          onPrev={navPrev}
          onNext={navNext}
          onJump={navJump}
          onRestart={navRestart}
        />

      </div>

      <footer className="lc-footer">
        <button
          type="button"
          className="lc-footer-reset"
          onClick={onResetGalaxy}
          title="Reset the galaxy — clear the current scenario, filters and URL"
        >
          <kbd>Esc</kbd>
          <span>Reset</span>
        </button>
        <span className="lc-footer-hint"><kbd>P</kbd> Present</span>
        <span className="lc-footer-hint"><kbd>←</kbd> <kbd>→</kbd> Steps</span>
        <span className="lc-footer-hint"><kbd>Space</kbd> Play / Pause</span>
      </footer>

      <Spotlight
        onSelectScenario={handlePickScenario}
        onSelectNode={setSpotlightTarget}
      />

      <HelpModal open={overlay.isOpen(OVERLAY.help)} onClose={closeHelp} />

      <ConnectAgentModal status={aiConnection.status} />

      <ChangelogPanel
        open={overlay.isOpen(OVERLAY.changelog) && !warping}
        stacked={overlay.isStacked(OVERLAY.changelog)}
        onClose={() => overlay.close(OVERLAY.changelog)}
        onSelectNode={(target) => {
          setSpotlightTarget(target);
          // On phones the inspector stacks on top; closing it returns to the search.
          if (!isMobile) overlay.close(OVERLAY.changelog);
        }}
        onActivateItem={onActivateChangelogItem}
        focus={changelogFocus}
      />

      {/* Hyperspace warp played when a changelog item is clicked — lands on
          the item's node once it finishes. */}
      {warping && <WarpTransition duration={1600} onDone={onWarpDone} />}

      {presentation && (
        <>
          <button
            type="button"
            className="lc-present-exit"
            onClick={() => setPresentation(false)}
            aria-label="Exit presentation mode"
            title="Exit presentation mode (Esc)"
          >
            <svg width={14} height={14} viewBox="0 0 14 14" aria-hidden="true">
              <path d="M3 3 L11 11 M11 3 L3 11" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" />
            </svg>
          </button>
          <div className="lc-present-hint">
            <kbd>Esc</kbd> exit · <kbd>←</kbd> <kbd>→</kbd> steps
          </div>
        </>
      )}
    </div>
  );
}
