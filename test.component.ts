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

  public testIt(param1, param2) {
    thisiswrong.call();
    param1.pe.text = '';
    param2.pf[0] = '';
    this.someval = 's';
    sessionStorage.setItem('3', '2')
    return;
  }
};