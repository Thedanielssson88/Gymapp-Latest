type BackHandler = () => void;

// En stack med funktioner som ska köras vid bakåt-tryck
const handlers: BackHandler[] = [];

/**
 * Registrera en funktion som ska köras när användaren trycker Bakåt.
 * Returnerar en funktion för att avregistrera (används vid cleanup i useEffect).
 */
export const registerBackHandler = (handler: BackHandler) => {
  handlers.push(handler);
  return () => {
    const index = handlers.indexOf(handler);
    if (index > -1) {
      handlers.splice(index, 1);
    }
  };
};

/**
 * Körs av huvudkomponenten. Returnerar true om något hanterades internt, annars false.
 */
export const executeBackHandler = (): boolean => {
  if (handlers.length > 0) {
    const handler = handlers.pop();
    if (handler) {
      handler();
      return true; 
    }
  }
  return false;
};
