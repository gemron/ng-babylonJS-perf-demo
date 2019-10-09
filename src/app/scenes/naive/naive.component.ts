import {AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {NaiveService} from '../../services/naive.service';
import {AbstractMesh, MeshBuilder, Scene} from '@babylonjs/core';
import {PreferenceService} from '../../services/preference.service';
import {combineLatest, Subject} from 'rxjs';
import {debounceTime, takeUntil} from 'rxjs/operators';
import {AsteroidConfiguration, MeshConfiguration} from '../../models';
import {LoadingService} from '../../services/loading.service';

const FPS = 60;

@Component({
  selector: 'app-naive',
  templateUrl: './naive.component.html',
  styleUrls: ['./naive.component.scss']
})
export class NaiveComponent implements AfterViewInit, OnDestroy, OnInit {

  @ViewChild('rCanvas', {static: true})
  canvasRef: ElementRef<HTMLCanvasElement>;
  protected readonly destroy = new Subject<boolean>();
  protected asteroidConfig: AsteroidConfiguration;
  protected meshConfig: MeshConfiguration;
  protected readonly asteroids: AbstractMesh[] = [];

  constructor(
    protected readonly naive: NaiveService,
    protected readonly preferences: PreferenceService,
    protected readonly loading: LoadingService) {
  }

  ngOnInit(): void {
    this.loading.message$.next('Initialising Scene ...');
    this.initScene();

    combineLatest(this.preferences.asteroidConfig, this.preferences.meshConfig).pipe(takeUntil(this.destroy), debounceTime(400))
      .subscribe(([asteroidConfig, meshConfig]) => {
        this.asteroidConfig = asteroidConfig;
        this.meshConfig = meshConfig;
        this.manageAsteroids();
      });

    this.preferences.materialConfig.pipe(takeUntil(this.destroy)).subscribe(conf => conf.freeze
      ? this.naive.scene.freezeMaterials()
      : this.naive.scene.unfreezeMaterials());
  }

  initScene() {
    const scene = this.naive.createScene(this.canvasRef);
    scene.blockfreeActiveMeshesAndRenderingGroups = true;
    this.addPlanets(scene);
    scene.blockfreeActiveMeshesAndRenderingGroups = false;

  }

  ngAfterViewInit(): void {
    this.naive.start(this.preferences.useNgZone.getValue());
  }

  ngOnDestroy(): void {
    this.naive.stop();
  }

  manageAsteroids() {
    this.loading.message$.next('Manage Asteroids ...');
    this.naive.scene.unfreezeActiveMeshes();
    this.naive.scene.unfreezeMaterials();
    this.naive.scene.blockfreeActiveMeshesAndRenderingGroups = this.meshConfig.batch;
    this.clearAsteroids();
    this.loading.message$.next('Add Asteroids ...');
    // due to the possible blocking calculation a timeout is needed to display the message
    setTimeout(() => {
      this.addAsteroids(this.naive.scene, this.asteroidConfig.amount);

      if (this.preferences.materialConfig.getValue().freeze) {
        this.naive.scene.freezeMaterials();
      }

      if (this.meshConfig.freeze) {
        this.loading.message$.next('Freeze Meshes ...');
        this.naive.scene.freezeActiveMeshes(); // 5-10 fps
      }
      // this.naive.scene.freeActiveMeshes(); // better dispose
      this.naive.scene.blockfreeActiveMeshesAndRenderingGroups = false;
      this.loading.message$.next(null);
    }, 30);

  }

  clearAsteroids() {
    this.loading.message$.next('Remove Asteroids ...');
    this.asteroids.slice().forEach((asteroid) => {
      asteroid.dispose();
      this.asteroids.pop();
    });
  }

  addAsteroids(scene: Scene, amount: number) {
    for (let i = 0; i < amount; i++) {
      const s = MeshBuilder.CreateSphere(`sphere${i}`, {segments: this.asteroidConfig.segments, diameter: 1}, scene);
      this.naive.addRandomMaterial(s);
      this.naive.makeAsteroid(s, i);
      this.asteroids.push(s);
      s.isVisible = true;
    }
  }

  addPlanets(scene: Scene) {
    scene.beginAnimation(this.naive.createPlanetInSystem('mercury', .3, 4, [.5, .5, .5]), 0, FPS, true, 0.25);
    scene.beginAnimation(this.naive.createPlanetInSystem('venus', .4, 5, [.9, .9, 0]), 0, FPS, true, 0.2);
    scene.beginAnimation(this.naive.createPlanetInSystem('earth', .6, 6.1, [0, 0, 1]), 0, FPS, true, 0.12);
    scene.beginAnimation(this.naive.createPlanetInSystem('mars', .5, 7.3, [1, 0, 0]), 0, FPS, true, 0.1);
    scene.beginAnimation(this.naive.createPlanetInSystem('jupyter', 1.3, 10.5, [.95, .95, .85]), 0, FPS, true, 0.05);
  }
}
