import { Composition, Still } from 'remotion';
import { CounterclaimFilm, CounterclaimPoster } from './Film';

export const RemotionRoot = () => <>
  <Composition id="CounterclaimFilm" component={CounterclaimFilm} durationInFrames={1260} width={1920} height={1080} fps={30} defaultProps={{music:true}}/>
  <Composition id="CounterclaimFilmSfxOnly" component={CounterclaimFilm} durationInFrames={1260} width={1920} height={1080} fps={30} defaultProps={{music:false}}/>
  <Still id="CounterclaimPoster" component={CounterclaimPoster} width={1920} height={1080}/>
</>;
