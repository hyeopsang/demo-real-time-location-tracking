import {AdvancedMarker, APIProvider, Map} from '@vis.gl/react-google-maps';

function App() {
  const position = {lat: 53.54992, lng: 10.00678};

  return (
    <div className="App">
      <APIProvider apiKey={''}>
        <Map defaultCenter={position} defaultZoom={10} mapId="DEMO_MAP_ID">
          <AdvancedMarker position={position} />
        </Map>
      </APIProvider>
    </div>
  );
}

export default App;
