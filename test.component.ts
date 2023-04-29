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

  public testIt(param) {
    this.somesub.var.subscribe(a => a);
    this.somesub.func().subscribe(a => a);
    this.platform.hello();
    this.platform.hello();
    this.storage.no();
    this.userService.signIn();
    return;
  }
};