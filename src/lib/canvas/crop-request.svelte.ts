export class CropRequest {
  asked = $state(0);

  ask() {
    this.asked += 1;
  }
}

export const cropRequest = new CropRequest();
