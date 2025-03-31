import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import axios from 'axios';
import ReactFlow, { Node, Edge, MarkerType, Position } from 'reactflow';
import dagre from 'dagre';
import gsap from 'gsap';
import RabbitFlow from './RabbitFlow';
import MainNode from './nodes/MainNode';
import '../styles/search.css';
import { searchRabbitHole } from '../services/api';

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const nodeWidth = 600;
const nodeHeight = 500;
const questionNodeWidth = 300;
const questionNodeHeight = 100;

const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
  dagreGraph.setGraph({ 
    rankdir: 'LR', 
    nodesep: 800,
    ranksep: 500,
    marginx: 100,
    align: 'DL',
    ranker: 'tight-tree'
  });

  const allNodes = dagreGraph.nodes();
  allNodes.forEach(node => dagreGraph.removeNode(node));

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { 
      width: node.id === 'main' ? nodeWidth : questionNodeWidth,
      height: node.id === 'main' ? nodeHeight : questionNodeHeight 
    });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const newNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - (node.id === 'main' ? nodeWidth / 2 : questionNodeWidth / 2),
        y: nodeWithPosition.y - (node.id === 'main' ? nodeHeight / 2 : questionNodeHeight / 2)
      },
      targetPosition: Position.Left,
      sourcePosition: Position.Right
    };
  });

  return { nodes: newNodes, edges };
};

interface Source {
  title: string;
  url: string;
  uri: string;
  author: string;
  image: string;
}

interface ImageData {
  url: string;
  thumbnail: string;
  description: string;
}

interface SearchResponse {
  response: string;
  followUpQuestions: string[];
  sources: Source[];
  images: ImageData[];
  contextualQuery: string;
}

interface ConversationMessage {
  user?: string;
  assistant?: string;
}

const nodeTypes = {
  mainNode: MainNode,
};

const useDeckHoverAnimation = (deckRef: React.RefObject<HTMLDivElement>) => {
  useEffect(() => {
    if (!deckRef.current) return;

    const deck = deckRef.current;
    const symbol = deck.querySelector('svg');
    const card = deck.querySelector('.card-content');
    let floatingAnimation: gsap.core.Timeline;

    gsap.set(symbol, { scale: 1 });
    gsap.set(card, { 
      y: 0, 
      rotate: 0,
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
    });

    const createFloatingAnimation = () => {
      const timeline = gsap.timeline({
        repeat: -1,
        yoyo: true,
        defaults: { duration: 2, ease: "power1.inOut" }
      });

      const randomRotation = (Math.random() - 0.5) * 10;
      
      timeline
        .to(card, {
          y: -15,
          x: 5,
          rotate: randomRotation,
          boxShadow: '0 20px 30px -10px rgba(0, 0, 0, 0.3)',
          duration: 2
        })
        .to(card, {
          y: -10,
          x: -5,
          rotate: -randomRotation,
          boxShadow: '0 15px 25px -8px rgba(0, 0, 0, 0.25)',
          duration: 2
        })
        .to(card, {
          y: -20,
          x: 0,
          rotate: 0,
          boxShadow: '0 25px 35px -12px rgba(0, 0, 0, 0.35)',
          duration: 2
        });

      timeline
        .to(symbol, {
          scale: 1.1,
          rotate: 5,
          duration: 3,
          ease: "none"
        }, 0)
        .to(symbol, {
          scale: 1.15,
          rotate: -5,
          duration: 3,
          ease: "none"
        }, 3);

      return timeline;
    };

    const onHover = () => {
      if (floatingAnimation) {
        floatingAnimation.kill();
      }

      floatingAnimation = createFloatingAnimation();
      
      gsap.to(card, {
        boxShadow: '0 20px 30px -10px rgba(0, 0, 0, 0.3), 0 0 20px rgba(255, 255, 255, 0.1)',
        duration: 0.5
      });

      deck.classList.add('particles-active');
    };

    const onHoverOut = () => {
      if (floatingAnimation) {
        floatingAnimation.kill();
      }

      gsap.to(symbol, {
        scale: 1,
        rotate: 0,
        duration: 0.5,
        ease: 'power2.out'
      });

      gsap.to(card, {
        y: 0,
        x: 0,
        rotate: 0,
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        duration: 0.5,
        ease: 'power2.out',
        clearProps: 'all' // Clear all applied properties
      });

      deck.classList.remove('particles-active');
    };

    deck.addEventListener('mouseenter', onHover);
    deck.addEventListener('mouseleave', onHoverOut);

    return () => {
      if (floatingAnimation) {
        floatingAnimation.kill();
      }
      deck.removeEventListener('mouseenter', onHover);
      deck.removeEventListener('mouseleave', onHoverOut);
    };
  }, [deckRef]);
};

const DECK_QUESTIONS = {
  thoth: [
    "How can leaders balance creativity with execution?",
    "What are the key mindsets that drive innovation?",
    "How does curiosity shape leadership?",
    "What’s the biggest barrier to personal and professional growth?",
    "How can leaders foster a culture of continuous learning?",
    "What’s the most underrated skill for effective leadership in tech?"
  ],
  anubis: [
    "What’s the next big technological breakthrough no one sees coming?",
    "How will AI reshape human creativity?",
    "What industries are most vulnerable to disruption in the next decade?",
    "How do we balance innovation with ethical responsibility?",
    "What’s the most exciting use of blockchain beyond finance?",
    "How will quantum computing change everything we know?"
  ],
  isis: [
    "What’s the biggest unsolved problem in software development?",
    "Why do most startups fail despite having great tech?",
    "What’s the hardest challenge in scaling a technology company?",
    "How can developers avoid over-engineering solutions?",
    "What’s the real bottleneck in AI adoption today?",
    "How do we design technology that truly empowers people?"
  ]
} as const;

const getRandomQuestion = (category: keyof typeof DECK_QUESTIONS) => {
  const questions = DECK_QUESTIONS[category];
  const randomIndex = Math.floor(Math.random() * questions.length);
  return questions[randomIndex];
};

const SearchView: React.FC = () => {
  const [query, setQuery] = useState('');
  const [searchResult, setSearchResult] = useState<SearchResponse | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<ConversationMessage[]>([]);
  const [currentConcept, setCurrentConcept] = useState<string>('');
  const [isBootingFromURL, setIsBootingFromURL] = useState(false);
  const [autoSearchTriggered, setAutoSearchTriggered] = useState(false);
  const taglines = [
  "🧠 The rabbit is searching the web and digging your knowledge hole",
  "🔍 Assembling the puzzle pieces of truth",
  "🌐 Consulting the oracles of the internet",
  "🦾 Letting the AI do the thinking for now",
  "📚 Pulling insights from the deepest corners of the web",
  "⏳ Gathering signals from every possible source",
  "🤖 Your knowledge is brewing. Hang tight",
  "📡 Calibrating the brainwaves",
];

const [currentTaglineIndex, setCurrentTaglineIndex] = useState(0);
  
  const activeRequestRef = useRef<{ [key: string]: AbortController | null }>({});

  const thothDeckRef = useRef<HTMLDivElement>(null);
  const anubisDeckRef = useRef<HTMLDivElement>(null);
  const isisDeckRef = useRef<HTMLDivElement>(null);

  const [deckQuestions, setDeckQuestions] = useState({
    thoth: getRandomQuestion('thoth'),
    anubis: getRandomQuestion('anubis'),
    isis: getRandomQuestion('isis')
  });

  const refreshDeckQuestion = (category: keyof typeof DECK_QUESTIONS) => {
    setDeckQuestions(prev => ({
      ...prev,
      [category]: getRandomQuestion(category)
    }));
  };

  useDeckHoverAnimation(thothDeckRef);
  useDeckHoverAnimation(anubisDeckRef);
  useDeckHoverAnimation(isisDeckRef);

  useEffect(() => {
    return () => {
      Object.values(activeRequestRef.current).forEach(controller => {
        if (controller) {
          controller.abort();
        }
      });
    };
  }, []);

  useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const q = params.get("q");
  const concept = params.get("concept");

   if (q) {
    setQuery(q);
    if (concept) setCurrentConcept(concept);
    setIsBootingFromURL(true); // 🧠 show overlay
    setAutoSearchTriggered(true);
  }
}, []);

  useEffect(() => {
  if (autoSearchTriggered && query.trim()) {
    handleSearch();
    setAutoSearchTriggered(false);
  }
}, [autoSearchTriggered, query]);

  useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const q = params.get("q");
  const concept = params.get("concept");

  if (q) {
    setQuery(q);
    if (concept) setCurrentConcept(concept);

    // Delay search until query state is set
    setTimeout(() => {
      handleSearch();
    }, 100); // slight delay to avoid race conditions
  }
}, []);

   useEffect(() => {
  if (!isBootingFromURL) return;

  const interval = setInterval(() => {
    setCurrentTaglineIndex((prev) => (prev + 1) % taglines.length);
  }, 4500); // rotate every 4.5 seconds

  return () => clearInterval(interval);
}, [isBootingFromURL]);


  const handleNodeClick = async (node: Node) => {
    if (!node.id.startsWith('question-') || node.data.isExpanded) return;

    // Check if there are any active requests
    const hasActiveRequests = Object.values(activeRequestRef.current).some(controller => controller !== null);
    if (hasActiveRequests) return;

    if (activeRequestRef.current[node.id]) {
      activeRequestRef.current[node.id]?.abort();
    }

    const abortController = new AbortController();
    activeRequestRef.current[node.id] = abortController;

    const questionText = node.data.label;
    setIsLoading(true);

    try {
      const lastMainNode = nodes.find(n => n.type === 'mainNode');
      if (lastMainNode) {
        const newHistoryEntry: ConversationMessage = {
          user: lastMainNode.data.label,
          assistant: lastMainNode.data.content
        };
        setConversationHistory(prev => [...prev, newHistoryEntry]);
      }

      setNodes(prevNodes => prevNodes.map(n => {
        if (n.id === node.id) {
          return {
            ...n,
            type: 'mainNode',
            style: {
              ...n.style,
              width: nodeWidth,
              height: nodeHeight
            },
            data: { 
              ...n.data, 
              content: 'Loading...',
              isExpanded: true 
            }
          };
        }
        return n;
      }));

      const response = await searchRabbitHole({
        query: questionText,
        previousConversation: conversationHistory,
        concept: currentConcept,
        followUpMode: 'expansive'
      }, abortController.signal);

      if (activeRequestRef.current[node.id] === abortController) {
        setNodes(prevNodes => {
          const transformedNodes = prevNodes.map(n => {
            if (n.id === node.id) {
              return {
                ...n,
                type: 'mainNode',
                style: {
                  ...n.style,
                  width: nodeWidth,
                  minHeight: '500px',
                  background: '#1a1a1a',
                  opacity: 1,
                  cursor: 'default' 
                },
                data: {
                  label: response.contextualQuery || questionText,
                  content: response.response,
                  images: response.images?.map((img: ImageData) => img.url),
                  sources: response.sources,
                  isExpanded: true 
                }
              };
            }
            return n;
          });

          const newFollowUpNodes: Node[] = response.followUpQuestions.map((question: string, index: number) => {
            const uniqueId = `question-${node.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${index}`;
            return {
              id: uniqueId,
              type: 'default',
              data: { 
                label: question,
                isExpanded: false,
                content: '',
                images: [],
                sources: []
              },
              position: { x: 0, y: 0 },
              style: {
                width: questionNodeWidth,
                background: '#1a1a1a',
                color: '#fff',
                border: '1px solid #333',
                borderRadius: '8px',
                fontSize: '14px',
                textAlign: 'left',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                cursor: 'pointer' 
              }
            };
          });

          const currentEdges = edges;
          const newEdges: Edge[] = newFollowUpNodes.map((followUpNode) => ({
            id: `edge-${followUpNode.id}`,
            source: node.id,
            target: followUpNode.id,
            style: {
              stroke: 'rgba(248, 248, 248, 0.8)',
              strokeWidth: 1.5
            },
            type: 'smoothstep',
            animated: true,
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: 'rgba(248, 248, 248, 0.8)'
            }
          }));

          const { nodes: finalLayoutedNodes } = getLayoutedElements(
            [...transformedNodes, ...newFollowUpNodes],
            [...currentEdges, ...newEdges]
          );

          setEdges([...currentEdges, ...newEdges]);

          return finalLayoutedNodes;
        });
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.name !== 'AbortError' && activeRequestRef.current[node.id] === abortController) {
        console.error('Failed to process node click:', error);

        setNodes(prevNodes => prevNodes.map(n => {
          if (n.id === node.id) {
            return {
              ...node,
              data: {
                ...node.data,
                isExpanded: false
              },
              style: {
                ...node.style,
                opacity: 1
              }
            };
          }
          return n;
        }));
      }
    } finally {
      if (activeRequestRef.current[node.id] === abortController) {
        activeRequestRef.current[node.id] = null;
        setIsLoading(false);
      }
    }
  };

  const handleSearch = async () => {
    if (!query.trim()) return;

    try {
      setIsLoading(true);
      const loadingNode: Node = {
        id: 'main',
        type: 'mainNode',
        data: { 
          label: query,
          content: 'Loading...',
          images: [],
          sources: [],
          isExpanded: true 
        },
        position: { x: 0, y: 0 },
        style: {
          width: nodeWidth,
          height: nodeHeight,
          minHeight: nodeHeight,
          background: '#1a1a1a',
          color: '#fff',
          border: '1px solid #333',
          borderRadius: '8px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          cursor: 'default' 
        }
      };

      setNodes([loadingNode]);
      setEdges([]);

      const response = await searchRabbitHole({
        query,
        previousConversation: conversationHistory,
        concept: currentConcept,
        followUpMode: 'expansive'
      });
      setSearchResult(response);
      
      const mainNode: Node = {
        ...loadingNode,
        data: { 
          label: response.contextualQuery || query,
          content: response.response,
          images: response.images?.map((img: ImageData) => img.url),
          sources: response.sources,
          isExpanded: true 
        }
      };
      const followUpNodes: Node[] = response.followUpQuestions.map((question: string, index: number) => ({
        id: `question-${index}`,
        type: 'default',
        data: { 
          label: question,
          isExpanded: false,
          content: '',
          images: [],
          sources: []
        },
        position: { x: 0, y: 0 },
        style: {
          width: questionNodeWidth,
          background: '#1a1a1a',
          color: '#fff',
          border: '1px solid #333',
          borderRadius: '8px',
          fontSize: '14px',
          textAlign: 'left',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          cursor: 'pointer'
        }
      }));

      const edges: Edge[] = followUpNodes.map((_, index) => ({
        id: `edge-${index}`,
        source: 'main',
        target: `question-${index}`,
        style: { 
          stroke: 'rgba(248, 248, 248, 0.8)', 
          strokeWidth: 1.5
        },
        type: 'smoothstep',
        animated: true,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: 'rgba(248, 248, 248, 0.8)'
        }
      }));


      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        [mainNode, ...followUpNodes],
        edges
      );

      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsBootingFromURL(false);
      setIsLoading(false);
    }
  };

  if (!searchResult) {
    return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#0A0A0A] relative">
      
      {isBootingFromURL && (
        <div className="absolute inset-0 bg-[#0A0A0A] text-white z-50 flex flex-col items-center justify-center text-center px-8">
           <span className="loader mb-6"></span> {/* ⬅️ Your spinner here */}
          <div className="text-2xl md:text-3xl font-semibold transition-opacity duration-500 ease-in-out tagline-glow">
          {taglines[currentTaglineIndex]}
          </div>
          <div className="mt-4 text-sm text-gray-300">
            You will visualize it very soon.
          </div>
        </div>
      )}
        <a
          href="https://www.konfront.mx"
          target="_blank"
          rel="noopener noreferrer"
          className="fixed top-6 right-6 z-50 transform hover:scale-110 transition-transform duration-300 group"
        >
          <div className="relative">
            <div className="absolute -inset-2 bg-gradient-to-r from-[#2c2c2c] via-[#3c3c3c] to-[#2c2c2c] rounded-full opacity-0 group-hover:opacity-30 transition duration-500 blur-sm animate-gradient-xy"></div>
            <svg
              className="w-8 h-8 text-white/70 hover:text-white/90 transition-colors duration-300"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
          </div>
        </a>
        <div className="w-full max-w-2xl mx-auto text-center relative">
          <div className="mb-12 animate-float">
            <svg className="w-16 h-16 mx-auto animate-pulse-glow" viewBox="0 0 24 24" fill="none" stroke="rgba(255, 255, 255, 0.8)" strokeWidth="1">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="6" />
              <circle cx="12" cy="12" r="2" />
              <path d="M12 2v2M12 20v2M2 12h2M20 12h2" />
              <path d="M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
            </svg>
          </div>
          
          <h1 className="font-mystical text-3xl font-light mb-8 text-white opacity-90 tracking-[0.1em] uppercase">
            Step Into the RabbitHole:
            One Question, Infinite Paths.
          </h1>

          <div className="grid grid-cols-3 gap-8 mb-12 max-w-4xl mx-auto">
            <div 
              ref={thothDeckRef}
              onClick={() => {
                setQuery(deckQuestions.thoth);
                refreshDeckQuestion('thoth');
              }}
              className="group cursor-pointer perspective-1000"
            >
              <div className="card-content relative w-full aspect-[2/3] transform transition-transform duration-500 group-hover:rotate-y-180 preserve-3d">
                <div className="absolute w-full h-full bg-gradient-to-b from-[#1a1a1a] to-[#0d0d0d] border border-white/10 rounded-lg flex items-center justify-center backface-hidden">
                  <svg className="w-12 h-12 text-white/40" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M12 4L8 8M12 4L16 8M12 4V20M4 12H20" strokeWidth="1" />
                  </svg>
                </div>
                <div className="absolute w-full h-full bg-[#111111] border border-white/10 rounded-lg p-4 rotate-y-180 backface-hidden">
                  <div className="text-white/70 text-sm font-light">Deck of Thoth</div>
                  <div className="mt-4 text-white/50 text-xs font-light italic">
                    {deckQuestions.thoth}
                  </div>
                </div>
              </div>
            </div>

            <div 
              ref={anubisDeckRef}
              onClick={() => {
                setQuery(deckQuestions.anubis);
                refreshDeckQuestion('anubis');
              }}
              className="group cursor-pointer perspective-1000"
            >
              <div className="card-content relative w-full aspect-[2/3] transform transition-transform duration-500 group-hover:rotate-y-180 preserve-3d">
                <div className="absolute w-full h-full bg-gradient-to-b from-[#1a1a1a] to-[#0d0d0d] border border-white/10 rounded-lg flex items-center justify-center backface-hidden">
                  <svg className="w-12 h-12 text-white/40" viewBox="0 0 1388 1388" fill="none" stroke="currentColor">
                   <path transform="translate(597,73)" d="m0 0h13l26 6 24 7 47 17 42 19 24 13 24 14 18 10 12 8 19 13 18 14 14 11 14 13 8 7 13 13 11 15h51l28 4 27 6 24 7 24 9 25 12 19 12 21 16 21 18v2l4 2 4 4v2h2l7 8 11 12 13 17 14 21 9 15 14 23 9 16 3 9v17l-4 17-12 26-12 25-8 13-9 15-18 22-13 13-8 7-10 8-13 8-30 16-1 5 3 28 2 25 1 22v52l-2 32-3 22-4 22-7 26-8 21-10 21-7 17-8 13-11 17-9 13-16 21-11 12-7 8-13 13-11 9-15 12-3 7-1 7 28 2 24 4 17 6 17 9 14 10 14 12 10 10 9 11 7 10 8 14 6 17 2 11v23l-3 12-5 10-8 10-7 5-7 2h-264l-20 1h-71l-64-3-42-1h-43l-60 2-140 1-58 3h-22l-14-3-8-4-6-6-1-3v-18l4-14 15-35 11-22 9-14 5-5-2-4-15-14-9-9-13-17-9-12-13-16-7-9-3 19-3 5-5 3-15 1h-11l-21-2-28-7-20-7-14-7-14-10-10-9-12-12-9-12-10-16-10-21-7-23-4-20-2-16v-18l2-17 4-18 6-15 9-17 11-16 10-11 5-5 12-11 15-10 19-10 17-6 18-4 7-1h19l14 1 13-38 14-31 12-22 12-18 16-22 11-13 8-10 14-15 23-23 11-9 14-12 14-11 13-10 17-11 21-12 23-12 45-18 25-8 33-8 26-5 21-3 38-3h50l30 3 19 2-2-8-2-17-1-17-20-4-18-6-30-13-19-8-19-10-19-12-12-8-21-16-13-10-12-11-28-28-9-11-12-16-22-33-10-18-10-21-6-16-3-12v-20l4-12 8-11 7-6 13-6 8-1h31l33 2 4-16 4-6 5-5 7-5zm-46 102 1 5 7 13 14 21 11 13 9 11 29 29 8 7 13 11 18 13 11 7 28 16 38 16 33 10 25 7 29 6 5 1 1 8v11l-2 17-6 24-1 22 2 17 6 24 6 18 8 18 10 17 9 12 9 10 5 5 10 9 14 10 18 10 21 10 13 4 24 5 16 2h33l14-2 26-7 22-8 17-9 17-12 15-13 1-3 3-1 7-8 11-14 10-15 14-25 5-8v-7l-8-14-10-15-14-23-12-16-9-11-20-20-11-9-14-11-15-10-19-11-17-8-22-8-17-4-23-3h-43l-29 3-19 5-18 6h-5l-6-5-13-17-9-10-9-9-17-13-18-14-20-14-32-21-18-10-16-8-23-10-22-8-30-8-34-7-37-4zm121 338-32 2-32 4-38 8-29 9-25 9-17 8-23 13-18 11-20 14-13 11-10 8-10 9-8 7-10 10-8 7-12 13-9 11-10 14-11 18-10 17-8 14-11 27-9 28-8 32-4 34v36l3 28 5 28 6 23 8 21 14 29 9 15 9 12 8 10 15 15 12 7 7 2 54 4h48l29-4 22-6 21-7 21-10 12-8 13-11 8-7 10-10 8-10 8-11 11-18 9-17 8-20 7-23 5-29 1-10v-36l-3-19-6-21-7-17-10-19-12-16-11-12-8-7-13-10-21-13-23-11-20-7-23-6-18-3h-14l-20 3-23 7-13 2-3-11-4-17v-24l3-5 16-8 13-4 12-2h43l29 3 30 7 21 7 24 11 26 15 18 13 13 11 8 7 11 12 13 18 9 15 12 22 8 20 6 23 4 21 1 12v31l-2 22-6 35-6 25-5 16-5 13-8 16-9 17-11 16-11 14-12 13-16 16-3 4 1 3 17 1 32 1 32 3 31 6h2l1-12 1-89 2-5 6-3 9-2 25-2h18v68l-3 104v39l1 5h78l22-1h54l28 1h38l13-2-2-5-7-11-11-13-11-9-15-7-12-3-7-1-17-1-57-1v-20l1-10v-53l-2-49-2-37v-16l9-3 19-4 13-2 3 16 1 9v18l4-2 11-12 9-11 13-16 14-24 11-21 8-19 7-21 7-28 4-27 2-22v-45l-3-37-4-28h-9l-11 1h-30l-31-3-28-7-22-8-23-11-17-10-15-10-12-9-13-11-17-17-11-14-9-12-12-21-11-23-4-2-24-4-26-3-32-2zm-468 319-18 4-15 8-12 11-10 13-8 16-3 11-1 9v19l2 14 5 16 8 15 10 13 12 11 13 10 12 6 9 3 22 2h10l5 2 1 3h2l-2-10-8-26-6-19-6-27-4-26-2-23v-38l1-12-1-5zm346 303-40 6-11 1h-35l-33-3h-27l-6 7-5 16-2 8 1 8 16 6 36 8 15 2 16 1h41l21-2 33-5 27-2h39l79 3 41 1-1-5-7-10-11-11-11-7-12-5-22-5-26-3-22-1-38-1-8-1-9-5-6-1z" fill="currentColor"/>
                    <path transform="translate(1014,407)" d="m0 0h19l10 4 9 6 6 7 6 12 2 10-1 13-4 11-6 9-8 7-10 5-14 3-13-1-10-4-5-4-8-11-5-13-1-5v-14l4-12 7-10 9-8z" fill="currentColor"/>
                    <path transform="translate(264,1065)" d="m0 0 3 1z" fill="currentColor"/>
                    <path transform="translate(265,1062)" d="m0 0" fill="currentColor"/>
                  </svg>
                </div>
                <div className="absolute w-full h-full bg-[#111111] border border-white/10 rounded-lg p-4 rotate-y-180 backface-hidden">
                  <div className="text-white/70 text-sm font-light">Deck of Anubis</div>
                  <div className="mt-4 text-white/50 text-xs font-light italic">
                    {deckQuestions.anubis}
                  </div>
                </div>
              </div>
            </div>

            <div 
              ref={isisDeckRef}
              onClick={() => {
                setQuery(deckQuestions.isis);
                refreshDeckQuestion('isis');
              }}
              className="group cursor-pointer perspective-1000"
            >
              <div className="card-content relative w-full aspect-[2/3] transform transition-transform duration-500 group-hover:rotate-y-180 preserve-3d">
                <div className="absolute w-full h-full bg-gradient-to-b from-[#1a1a1a] to-[#0d0d0d] border border-white/10 rounded-lg flex items-center justify-center backface-hidden">
                  <svg className="w-12 h-12 text-white/40" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <circle cx="12" cy="12" r="8" strokeWidth="1" />
                    <path d="M12 4V2M12 22V20M4 12H2M22 12H20" strokeWidth="1" />
                  </svg>
                </div>
                <div className="absolute w-full h-full bg-[#111111] border border-white/10 rounded-lg p-4 rotate-y-180 backface-hidden">
                  <div className="text-white/70 text-sm font-light">Deck of Isis</div>
                  <div className="mt-4 text-white/50 text-xs font-light italic">
                    {deckQuestions.isis}
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="relative w-full max-w-xl mx-auto group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-[#2c2c2c] via-[#3c3c3c] to-[#2c2c2c] rounded-full opacity-30 group-hover:opacity-50 transition duration-1000 group-hover:duration-200 animate-gradient-xy blur-sm"></div>
            <input
              type="text"
              className="w-full px-6 py-4 rounded-full bg-[#111111] text-white/90 border border-white/10 focus:border-white/20 focus:outline-none placeholder-white/30 shadow-lg backdrop-blur-sm font-light tracking-wide"
              value={query}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
              onKeyPress={(e: React.KeyboardEvent) => e.key === 'Enter' && handleSearch()}
              placeholder="Ask any question to explore a knowledge rabbithole"
              disabled={isLoading}
            />
            {isLoading ? (
              <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                <div className="w-5 h-5 border border-white/20 rounded-full animate-spin border-t-white/80"></div>
              </div>
            ) : (
              <button 
                onClick={handleSearch}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 p-2 rounded-full hover:bg-white/5 transition-colors duration-200"
              >
                <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            )}
          </div>
          
          <div className="mt-8 text-white/40 text-sm font-light tracking-wider animate-pulse-glow">
            A search engine for the curious—ask anything and watch ideas unfold
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <RabbitFlow 
        initialNodes={nodes} 
        initialEdges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
      />
    </div>
  );
};

export default SearchView; 
