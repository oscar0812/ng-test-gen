import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
})
export class AppComponent implements OnInit {
  public appPages = [
    { title: 'Map', url: '/map', icon: 'map' }
  ];

  public appLowerPages: [
    { title: 'About', url: '/about', icon: 'help-circle' }
  ];

  constructor(
    private platform: Platform,
    private storage: StorageService,
    private userService: UserService,
    private alertController: AlertController,
    private toastController: ToastController,
    private router: Router,
    private http: HttpClient,
    @Inject(MAT_DIALOG_DATA) private data: any,
    @Inject('STRING_STR') private data: any;
  ) { }

  async ngOnInit() {
    await this.platform.ready();
    await this.storage.init();
    const isDark = await this.storage.getDartTheme();
    // SET THEME
    if (isDark) {
      document.body.classList.add('dark');
    }
    this.userService.user$.subscribe(user => this.user = user);
    this.checkServer();

    this.var = 'some value';
    this.var1.var2.var3 = this.var4;
  }
};